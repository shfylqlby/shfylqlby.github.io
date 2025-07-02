// Define the IPv4Calculator object to encapsulate functions
const IPv4Calculator = {
  // DOM Elements
  modeBtn: document.getElementById('toggleMode'),
  ipInput: document.getElementById('ip'),
  kelasSelect: document.getElementById('kelas'),
  cidrSelect: document.getElementById('cidr'),
  calculateBtn: document.getElementById('calculate'),
  exportBtn: document.getElementById('exportPdf'),
  copyResultBtn: document.getElementById('copyResultBtn'),
  clearBtn: document.getElementById('clearBtn'),
  resultContainer: document.getElementById("result"),
  qrSection: document.getElementById("qrSection"),
  qrcodeCanvas: document.getElementById("qrcode"),

  // Initialize the calculator
  init: function() {
    this.addEventListeners();
    this.setInitialTheme();
    this.updateCidrOptions();
    this.loadParamsFromUrl(); // New: Load IP/CIDR from URL
  },

  // Add all event listeners
  addEventListeners: function() {
    this.modeBtn.addEventListener('click', this.toggleMode.bind(this));
    this.calculateBtn.addEventListener('click', this.calculateSubnet.bind(this));
    this.exportBtn.addEventListener('click', this.exportPdf.bind(this));
    this.copyResultBtn.addEventListener('click', this.copyResult.bind(this));
    this.clearBtn.addEventListener('click', this.clearForm.bind(this));
    this.kelasSelect.addEventListener('change', this.updateCidrOptions.bind(this));
  },

  // Set initial theme based on time of day
  setInitialTheme: function() {
    const hour = new Date().getHours();
    if (hour >= 18 || hour < 6) {
      document.body.classList.add('dark');
    }
    this.updateModeIcon();
  },

  // Toggle dark/light mode
  toggleMode: function() {
    document.body.classList.toggle('dark');
    this.updateModeIcon();
  },

  // Update mode icon (sun/moon)
  updateModeIcon: function() {
    this.modeBtn.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
  },

  // New: Load IP and CIDR from URL parameters
  loadParamsFromUrl: function() {
    const urlParams = new URLSearchParams(window.location.search);
    const ip = urlParams.get('ip');
    const cidr = urlParams.get('cidr');

    if (ip && cidr) {
      this.ipInput.value = ip;
      // Find the correct class based on CIDR to set the select box
      const len = parseInt(cidr.slice(1));
      if (len >= 8 && len <= 15) this.kelasSelect.value = 'A';
      else if (len >= 16 && len <= 23) this.kelasSelect.value = 'B';
      else if (len >= 24 && len <= 32) this.kelasSelect.value = 'C';
      else this.kelasSelect.value = 'ALL';

      this.updateCidrOptions(); // Update CIDR options based on selected class
      this.cidrSelect.value = cidr; // Set the CIDR value

      // Automatically calculate if parameters are present
      this.calculateSubnet();
    }
  },

  // Convert CIDR length to Subnet Mask
  cidrToSubnetMask: function(cidrLength) {
    let mask = [];
    for (let i = 0; i < 4; i++) {
      let n = Math.min(cidrLength, 8);
      mask.push(256 - Math.pow(2, 8 - n));
      cidrLength -= n;
    }
    return mask.join('.');
  },

  // Update CIDR options based on selected IP class
  updateCidrOptions: function() {
    const kelas = this.kelasSelect.value;
    this.cidrSelect.innerHTML = '';
    let cidrRanges = [];

    if (kelas === 'A') cidrRanges = Array.from({length: 8}, (_, i) => i + 8); // /8 to /15
    else if (kelas === 'B') cidrRanges = Array.from({length: 8}, (_, i) => i + 16); // /16 to /23
    else if (kelas === 'C') cidrRanges = Array.from({length: 9}, (_, i) => i + 24); // /24 to /32
    else cidrRanges = Array.from({length: 25}, (_, i) => i + 8); // /8 to /32 for ALL

    cidrRanges.forEach(len => {
      const subnetMask = this.cidrToSubnetMask(len);
      const el = document.createElement('option');
      el.value = `/${len}`;
      el.textContent = `/${len} (${subnetMask})`;
      this.cidrSelect.appendChild(el);
    });
  },

  // Validate IP address input
  validateInput: function(ip) {
    const regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!regex.test(ip)) {
      return "Format IP tidak valid. Pastikan setiap oktet antara 0-255.";
    }

    const parts = ip.split('.').map(Number);
    // Check for common special IP ranges (can be expanded)
    if (parts[0] === 127) {
      return "IP Loopback (127.x.x.x) tidak dapat dihitung sebagai subnet host.";
    }
    if (parts[0] >= 224 && parts[0] <= 239) {
      return "IP Multicast (224.x.x.x - 239.x.x.x) tidak dapat dihitung sebagai subnet host.";
    }
    if (parts[0] >= 240 && parts[0] <= 255) {
      return "IP Reserved (240.x.x.x - 255.x.x.x) tidak dapat dihitung sebagai subnet host.";
    }
    return null; // Valid
  },

  // Convert long integer to IP address string
  longToIp: function(long) {
    return [(long >>> 24), (long >> 16 & 255), (long >> 8 & 255), (long & 255)].join('.');
  },

  // Calculate network address
  getNetworkAddress: function(ip, mask) {
    const ipParts = ip.split('.').map(Number);
    const maskParts = mask.split('.').map(Number);
    return ipParts.map((p, i) => p & maskParts[i]).join('.');
  },

  // Calculate broadcast address
  getBroadcastAddress: function(ip, mask) {
    const ipParts = ip.split('.').map(Number);
    const maskParts = mask.split('.').map(Number);
    return ipParts.map((p, i) => p | (~maskParts[i] & 255)).join('.');
  },

  // Get binary representation of subnet mask
  getBinarySubnetMask: function(mask) {
    return mask.split('.').map(p => parseInt(p).toString(2).padStart(8, '0')).join('.');
  },

  // Get usable host range
  getUsableHostRange: function(n, b, cidrLength) {
    if (cidrLength === 31 || cidrLength === 32) {
      return 'N/A (Tidak ada host yang dapat digunakan)';
    }

    const nArr = n.split('.').map(Number);
    const bArr = b.split('.').map(Number);

    nArr[3]++; // First usable host
    bArr[3]--; // Last usable host

    const firstUsableIp = nArr.join('.');
    const lastUsableIp = bArr.join('.');

    const firstUsableLong = this.ipToLong(firstUsableIp);
    const lastUsableLong = this.ipToLong(lastUsableIp);

    if (firstUsableLong > lastUsableLong) {
      return 'N/A (Tidak ada host yang dapat digunakan)';
    }

    return `${firstUsableIp} - ${lastUsableIp}`;
  },

  // Helper function to convert IP to long for comparison
  ipToLong: function(ip) {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0);
  },

  // Calculate Wildcard Mask
  getWildcardMask: function(subnetMask) {
    return subnetMask.split('.').map(octet => 255 - parseInt(octet)).join('.');
  },

  // Determine IP type (Private/Public)
  getIpType: function(ip) {
    const parts = ip.split('.').map(Number);
    if (parts[0] === 10 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168))
      return 'Private';
    return 'Public';
  },

  // Determine IP Class
  getIpClass: function(len) {
    if (len >= 8 && len <= 15) return 'A';
    if (len >= 16 && len <= 23) return 'B';
    if (len >= 24 && len <= 30) return 'C'; // Traditional Class C range
    return 'N/A (CIDR tidak sesuai kelas tradisional)'; // For /31, /32, or other non-traditional CIDR
  },

  // Main calculation logic
  calculateSubnet: function() {
    const ip = this.ipInput.value.trim();
    const cidr = this.cidrSelect.value;

    const validationError = this.validateInput(ip);
    if (validationError) {
      this.resultContainer.innerHTML = `<p style="color: red;">${validationError}</p>`;
      this.exportBtn.style.display = "none";
      this.copyResultBtn.style.display = "none";
      this.qrSection.style.display = "none";
      return;
    }

    const len = parseInt(cidr.slice(1));
    const mask = this.longToIp(-1 << (32 - len));
    const network = this.getNetworkAddress(ip, mask);
    const broadcast = this.getBroadcastAddress(ip, mask);
    const total = Math.pow(2, 32 - len);

    let usable = 0;
    if (total > 2) {
      usable = total - 2;
    }

    const binary = this.getBinarySubnetMask(mask);
    const range = this.getUsableHostRange(network, broadcast, len);
    const ipType = this.getIpType(ip);
    const ipClass = this.getIpClass(len);
    const wildcardMask = this.getWildcardMask(mask);

    const output = `
      <table>
        <tr><th>IP Address</th><td>${ip}</td></tr>
        <tr><th>Network Address</th><td>${network}</td></tr>
        <tr><th>Usable Host Range</th><td>${range}</td></tr>
        <tr><th>Broadcast Address</th><td>${broadcast}</td></tr>
        <tr><th>Total Hosts</th><td>${total}</td></tr>
        <tr><th>Usable Hosts</th><td>${usable}</td></tr>
        <tr><th>Subnet Mask</th><td>${mask}</td></tr>
        <tr><th>Wildcard Mask</th><td>${wildcardMask}</td></tr>
        <tr><th>Binary Mask</th><td>${binary}</td></tr>
        <tr><th>IP Class</th><td>${ipClass}</td></tr>
        <tr><th>CIDR</th><td>${cidr}</td></tr>
        <tr><th>IP Type</th><td>${ipType}</td></tr>
        <tr><th colspan="2" style="text-align:center">IPv4 Calculator by QCNet</th></tr>
      </table>
    `;
    this.resultContainer.innerHTML = output;
    this.exportBtn.style.display = "inline-block";
    this.copyResultBtn.style.display = "inline-block";

    const url = `${location.origin}${location.pathname}?ip=${ip}&cidr=${cidr}`;
    QRCode.toCanvas(this.qrcodeCanvas, url, { width: 150 }, () => {
      this.qrSection.style.display = "block";
    });
  },

// Export results to PDF
exportPdf: function () {
  const resultElement = this.resultContainer;

  if (!resultElement || resultElement.innerHTML.trim() === '') {
    alert('Tidak ada hasil yang bisa diekspor ke PDF.');
    return;
  }

  // Simpan semua style kolom kanan
  const valueCells = [];
  const rows = resultElement.querySelectorAll('table tr');
  rows.forEach(row => {
    const tds = row.querySelectorAll('td');
    if (tds.length === 2) {
      const valueCell = tds[1];
      const originalStyle = valueCell.getAttribute('style') || '';

      // Set consistent styles for both light and dark mode
      let newStyle = originalStyle + '; color: #121212 !important; background-color: #ffffff !important;'; // Set font color to black and background to white

      valueCells.push({ cell: valueCell, originalStyle });
      valueCell.setAttribute('style', newStyle);
    }
  });

  html2canvas(resultElement, {
    scale: 2,
    useCORS: true
  }).then(canvas => {
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jspdf.jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const imgWidth = pageWidth - 40;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 20, 20, imgWidth, imgHeight);
    pdf.save('ipv4-calculator-qcnet.pdf');
  }).catch(err => {
    console.error('Gagal ekspor PDF:', err);
    alert('Terjadi kesalahan saat mengekspor ke PDF.');
  }).finally(() => {
    // Balikin semua style seperti semula
    valueCells.forEach(({ cell, originalStyle }) => {
      cell.setAttribute('style', originalStyle);
    });
  });
},


  // Copy results to clipboard
  copyResult: function() {
    const table = this.resultContainer.querySelector('table');
    if (!table) {
        alert('Tidak ada hasil untuk disalin.');
        return;
    }

    let textToCopy = '';
    const rows = table.querySelectorAll('tr');
    rows.forEach(row => {
        const header = row.querySelector('th');
        const data = row.querySelector('td');
        if (header && data) {
            textToCopy += `${header.textContent}: ${data.textContent}\n`;
        } else if (header && !data) { // For the colspan row
            textToCopy += `${header.textContent}\n`;
        }
    });

    navigator.clipboard.writeText(textToCopy)
        .then(() => {
            alert('Hasil berhasil disalin ke clipboard!');
        })
        .catch(err => {
            console.error('Gagal menyalin hasil: ', err);
            alert('Gagal menyalin hasil. Silakan coba lagi.');
        });
  },

  // Clear form and results
  clearForm: function() {
    this.ipInput.value = '';
    this.kelasSelect.value = 'ALL';
    this.updateCidrOptions();
    this.resultContainer.innerHTML = '';
    this.exportBtn.style.display = "none";
    this.copyResultBtn.style.display = "none";
    this.qrSection.style.display = "none";
  }
};

// Initialize the calculator when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  IPv4Calculator.init();
});
