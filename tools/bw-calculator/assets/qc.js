// assets/qc.js

// Global variables
let currentAnalysis = null;
let bandwidthChartInstance = null; // To store the Chart.js instance

// Utility Functions
const Utils = {
    formatNumber: function(num, decimals = 2) {
        if (isNaN(num) || num === null || num === undefined) return '0';
        if (num % 1 === 0) {
            return parseInt(num).toLocaleString('id-ID');
        }
        return parseFloat(num).toLocaleString('id-ID', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    },

    formatTraffic: function(gbps) {
        if (gbps >= 1) {
            return `${Utils.formatNumber(gbps)} Gbps`;
        } else {
            return `${Utils.formatNumber(gbps * 1000)} Mbps`;
        }
    },

    formatBps: function(bps) {
        if (isNaN(bps) || bps === null || bps === undefined) return '0';
        return parseInt(bps).toLocaleString('id-ID');
    },

    parseLocaleNumber: function(stringNumber) {
        if (typeof stringNumber !== 'string') {
            return parseFloat(stringNumber); // If it's already a number, just parse it
        }

        // Remove all thousand separators (both '.' and ',')
        // This simplified logic assumes that if both are present, the last one is decimal.
        // For example: "1.000,00" -> comma is decimal. "1,000.00" -> dot is decimal.
        // If only one is present, it's treated as a thousand separator, then decimal.
        let cleanedString = stringNumber.replace(/[,.]/g, (match) => {
            const lastDotIndex = stringNumber.lastIndexOf('.');
            const lastCommaIndex = stringNumber.lastIndexOf(',');

            // If comma is the last separator and dot is before it, comma is decimal. Remove dot.
            if (lastCommaIndex > lastDotIndex && match === '.') {
                return '';
            }
            // If dot is the last separator and comma is before it, dot is decimal. Remove comma.
            if (lastDotIndex > lastCommaIndex && match === ',') {
                return '';
            }
            // Otherwise, it's a thousand separator, so remove it.
            return '';
        });

        // After removing thousand separators, if there's still a comma, it must be the decimal.
        cleanedString = cleanedString.replace(',', '.');

        return parseFloat(cleanedString);
    },

    convertRateToBps: function(value, unit) {
        // Use parseLocaleNumber here
        const numValue = Utils.parseLocaleNumber(value);
        if (isNaN(numValue)) return 0;

        switch (unit) {
            case 'bps': return numValue;
            case 'Kbps': return numValue * 1000;
            case 'Mbps': return numValue * 1000000;
            case 'Gbps': return numValue * 1000000000;
            default: return numValue;
        }
    },

    getUtilizationStatus: function(percentage) {
        if (percentage >= 80) return 'status-critical';
        if (percentage >= 60) return 'status-warning';
        return 'status-good';
    },

    getUtilizationText: function(percentage) {
        if (percentage >= 80) return 'CRITICAL UTILIZATION';
        if (percentage >= 60) return 'MODERATE UTILIZATION';
        return 'NORMAL UTILIZATION';
    },

    getTrafficPattern: function(inputGbps, outputGbps) {
        if (outputGbps === 0 && inputGbps === 0) return 'No Traffic';
        if (outputGbps === 0) return 'Download Only';
        if (inputGbps === 0) return 'Upload Only';

        const ratio = inputGbps / outputGbps;
        if (ratio > 2) return 'Download Heavy';
        if (ratio < 0.5) return 'Upload Heavy';
        return 'Balanced Traffic';
    },

    getRecommendation: function(utilization) {
        if (utilization > 80) return '🚨 Immediate Capacity Upgrade Required';
        if (utilization > 60) return '⚠️ Enhanced Monitoring Required';
        return '✅ Normal Operation';
    }
};

// Traffic Analysis Calculator
function TrafficAnalyzer(inputBps, outputBps, portCapacityGbps) {
    this.inputBps = parseFloat(inputBps) || 0;
    this.outputBps = parseFloat(outputBps) || 0;
    this.portCapacityGbps = parseFloat(portCapacityGbps) || 10;
    this.portCapacityBps = this.portCapacityGbps * 1000000000;

    this.calculate();
}

TrafficAnalyzer.prototype.calculate = function() {
    // Convert to different units
    this.input = {
        bps: this.inputBps,
        kbps: this.inputBps / 1000,
        mbps: this.inputBps / 1000000,
        gbps: this.inputBps / 1000000000,
        utilization: (this.inputBps / this.portCapacityBps) * 100
    };

    this.output = {
        bps: this.outputBps,
        kbps: this.outputBps / 1000,
        mbps: this.outputBps / 1000000,
        gbps: this.outputBps / 1000000000,
        utilization: (this.outputBps / this.portCapacityBps) * 100
    };

    this.total = {
        bps: this.inputBps + this.outputBps,
        kbps: (this.inputBps + this.outputBps) / 1000,
        mbps: (this.inputBps + this.outputBps) / 1000000,
        gbps: (this.inputBps + this.outputBps) / 1000000000,
        // Calculate total utilization based on sum of input and output traffic
        utilization: ((this.inputBps + this.outputBps) / this.portCapacityBps) * 100
    };

    this.analysis = {
        pattern: Utils.getTrafficPattern(this.input.gbps, this.output.gbps),
        // Available bandwidth is based on the peak utilization
        availableBandwidth: this.portCapacityGbps - Math.max(this.input.gbps, this.output.gbps),
        recommendation: Utils.getRecommendation(this.total.utilization),
        portType: `${this.portCapacityGbps}G Ethernet`
    };
};

TrafficAnalyzer.prototype.generateReport = function() {
    return {
        timestamp: new Date().toLocaleString('en-US'), // Use en-US for consistency in CSV
        input: this.input,
        output: this.output,
        total: this.total,
        analysis: this.analysis,
        port: {
            capacity: this.portCapacityGbps,
            type: this.analysis.portType
        }
    };
};

// UI Controller
const UIController = {
    // Cache DOM elements for better performance
    elements: {
        container: document.querySelector('.container'),
        resultsDiv: document.getElementById('results'),
        // Bandwidth Inputs
        inputRateValue: document.getElementById('inputRateValue'),
        inputRateUnit: document.getElementById('inputRateUnit'),
        outputRateValue: document.getElementById('outputRateValue'),
        outputRateUnit: document.getElementById('outputRateUnit'),
        portCapacity: document.getElementById('portCapacity'),
        analyzeButton: document.getElementById('analyzeButton'),
        exportButton: document.getElementById('exportButton'),
        darkModeToggle: document.getElementById('darkModeToggle')
    },

    showLoading: function() {
        if (this.elements.container) {
            this.elements.container.classList.add('loading');
            // Disable buttons during loading
            this.elements.analyzeButton.disabled = true;
            this.elements.exportButton.disabled = true;
        }
    },

    hideLoading: function() {
        if (this.elements.container) {
            this.elements.container.classList.remove('loading');
            // Re-enable buttons after loading
            this.elements.analyzeButton.disabled = false;
            this.elements.exportButton.disabled = false;
        }
    },

    showError: function(message) {
        if (this.elements.resultsDiv) {
            // Clear previous results and display error
            this.elements.resultsDiv.innerHTML = `<div class="error-message">Error: ${message}</div>`;
            // Ensure chart/table are not rendered or are hidden if an error occurs
            if (bandwidthChartInstance) {
                bandwidthChartInstance.destroy();
                bandwidthChartInstance = null;
            }
        }
    },

    renderResults: function(analyzer) {
        const resultsHTML = `
            <div class="result-card card-summary fade-in">
                <h3 class="card-title">
                    <span>📊</span>
                    Real-time Traffic Summary
                </h3>
                <div class="metric">
                    <span class="metric-label">🔽 Input Traffic:</span>
                    <span class="metric-value">${Utils.formatTraffic(analyzer.input.gbps)}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">🔼 Output Traffic:</span>
                    <span class="metric-value">${Utils.formatTraffic(analyzer.output.gbps)}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">⚡ Port Capacity:</span>
                    <span class="metric-value">${Utils.formatNumber(analyzer.portCapacityGbps)} Gbps</span>
                </div>
                <div class="metric">
                    <span class="metric-label">📈 Peak Utilization:</span>
                    <span class="metric-value">
                        <span class="status-indicator ${Utils.getUtilizationStatus(analyzer.total.utilization)}"></span>
                        ${Utils.formatNumber(analyzer.total.utilization)}%
                        <small>(${Utils.getUtilizationText(analyzer.total.utilization)})</small>
                    </span>
                </div>
            </div>

            <div class="result-card card-input fade-in">
                <h3 class="card-title">
                    <span>📥</span>
                    Input Traffic Analysis (Download)
                </h3>
                <div class="metric">
                    <span class="metric-label">Rate (bps):</span>
                    <span class="metric-value">${Utils.formatBps(analyzer.input.bps)}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Rate (Kbps):</span>
                    <span class="metric-value">${Utils.formatNumber(analyzer.input.kbps)}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Rate (Mbps):</span>
                    <span class="metric-value">${Utils.formatNumber(analyzer.input.mbps)}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Rate (Gbps):</span>
                    <span class="metric-value">${Utils.formatNumber(analyzer.input.gbps)}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Utilization:</span>
                    <span class="metric-value">
                        <span class="status-indicator ${Utils.getUtilizationStatus(analyzer.input.utilization)}"></span>
                        ${Utils.formatNumber(analyzer.input.utilization)}%
                    </span>
                </div>
            </div>

            <div class="result-card card-output fade-in">
                <h3 class="card-title">
                    <span>📤</span>
                    Output Traffic Analysis (Upload)
                </h3>
                <div class="metric">
                    <span class="metric-label">Rate (bps):</span>
                    <span class="metric-value">${Utils.formatBps(analyzer.output.bps)}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Rate (Kbps):</span>
                    <span class="metric-value">${Utils.formatNumber(analyzer.output.kbps)}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Rate (Mbps):</span>
                    <span class="metric-value">${Utils.formatNumber(analyzer.output.mbps)}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Rate (Gbps):</span>
                    <span class="metric-value">${Utils.formatNumber(analyzer.output.gbps)}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Utilization:</span>
                    <span class="metric-value">
                                <span class="status-indicator ${Utils.getUtilizationStatus(analyzer.output.utilization)}"></span>
                                ${Utils.formatNumber(analyzer.output.utilization)}%
                            </span>
                        </div>
                    </div>

                    <!-- Network Health & Performance Summary -->
                    <div class="result-card card-utilization fade-in">
                        <h3 class="card-title">
                            <span>🩺</span>
                            Network Health & Performance Summary
                        </h3>
                        <div class="metric">
                            <span class="metric-label">Overall Status:</span>
                            <span class="metric-value">
                                <span class="status-indicator ${Utils.getUtilizationStatus(analyzer.total.utilization)}"></span>
                                ${Utils.getUtilizationText(analyzer.total.utilization)}
                            </span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Traffic Direction:</span>
                            <span class="metric-value">${analyzer.analysis.pattern}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Available Capacity:</span>
                            <span class="metric-value">${Utils.formatNumber(analyzer.analysis.availableBandwidth)} Gbps</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Recommended Action:</span>
                            <span class="metric-value">${analyzer.analysis.recommendation}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Last Analyzed:</span>
                            <span class="metric-value">${new Date().toLocaleTimeString('en-US')}</span>
                        </div>

                        <!-- New: Actionable Advice based on Network Health -->
                        <div class="metric" style="border-top: 1px solid rgba(255,255,255,0.2); padding-top: 15px; margin-top: 15px; display: block;">
                            <span class="metric-label" style="font-size: 1.1rem; font-weight: bold;">Next Steps:</span>
                            <p style="margin-top: 10px; font-size: 0.95rem; line-height: 1.5;">
                                ${(() => {
                                    const utilization = analyzer.total.utilization;
                                    if (utilization >= 80) {
                                        return '<strong>Action:</strong> Segera hubungi penyedia layanan atau tim IT Anda untuk menambah kapasitas. Jaringan Anda sangat padat dan berisiko tinggi mengalami gangguan.';
                                    } else if (utilization >= 60) {
                                        return '<strong>Action:</strong> Pantau terus penggunaan jaringan Anda. Pertimbangkan untuk mengoptimalkan penggunaan atau merencanakan peningkatan kapasitas di masa depan.';
                                    } else {
                                        return '<strong>Action:</strong> Jaringan Anda dalam kondisi optimal. Lanjutkan pemantauan rutin untuk menjaga performa terbaik.';
                                    }
                                })()}
                            </p>
                        </div>
                    </div>

                    <!-- Bandwidth Chart Card -->
                    <div class="result-card card-chart fade-in">
                        <h3 class="card-title">
                            <span>📈</span>
                            Bandwidth Traffic Chart
                        </h3>
                        <div class="chart-container">
                            <canvas id="bandwidthChart"></canvas>
                        </div>
                    </div>

                    <!-- Traffic Summary Table Card -->
                    <div class="result-card card-table fade-in">
                        <h3 class="card-title">
                            <span>📊</span>
                            Traffic Summary Table
                        </h3>
                        <table class="traffic-table">
                            <thead>
                                <tr>
                                    <th>Metric</th>
                                    <th>Value</th>
                                    <th>Unit</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Input Rate (Download)</td>
                                    <td>${analyzer.input.gbps >= 1 ? Utils.formatNumber(analyzer.input.gbps) : Utils.formatNumber(analyzer.input.gbps * 1000)}</td>
                                    <td>${analyzer.input.gbps >= 1 ? 'Gbps' : 'Mbps'}</td>
                                </tr>
                                <tr>
                                    <td>Output Rate (Upload)</td>
                                    <td>${analyzer.output.gbps >= 1 ? Utils.formatNumber(analyzer.output.gbps) : Utils.formatNumber(analyzer.output.gbps * 1000)}</td>
                                    <td>${analyzer.output.gbps >= 1 ? 'Gbps' : 'Mbps'}</td>
                                </tr>
                                <tr>
                                    <td>Total Traffic</td>
                                    <td>${analyzer.total.gbps >= 1 ? Utils.formatNumber(analyzer.total.gbps) : Utils.formatNumber(analyzer.total.gbps * 1000)}</td>
                                    <td>${analyzer.total.gbps >= 1 ? 'Gbps' : 'Mbps'}</td>
                                </tr>
                                <tr>
                                    <td>Port Capacity</td>
                                    <td>${Utils.formatNumber(analyzer.portCapacityGbps)}</td>
                                    <td>Gbps</td>
                                </tr>
                                <tr>
                                    <td>Peak Utilization</td>
                                    <td>${Utils.formatNumber(analyzer.total.utilization)}</td>
                                    <td>%</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                `;

        if (this.elements.resultsDiv) {
            this.elements.resultsDiv.innerHTML = resultsHTML;
            // Ensure chart is rendered after its canvas element is in DOM
            this.renderBandwidthChart(analyzer.input.gbps, analyzer.output.gbps);
        }
    },

    renderBandwidthChart: function(inputGbps, outputGbps) {
        const ctx = document.getElementById('bandwidthChart').getContext('2d');
        if (bandwidthChartInstance) {
            bandwidthChartInstance.destroy(); // Destroy previous chart instance
        }

        const bodyStyles = getComputedStyle(document.body);
        const isDarkMode = bodyStyles.getPropertyValue('background-color') === 'rgb(18, 18, 18)'; // Check if dark mode background is active

        const textColor = isDarkMode ? 'var(--chart-text-color-dark)' : 'var(--chart-text-color-light)';
        const gridColor = isDarkMode ? 'var(--chart-grid-color-dark)' : 'var(--chart-grid-color-light)';
        const inputBarColor = isDarkMode ? 'rgba(116, 185, 255, 0.8)' : 'var(--chart-input-color)';
        const outputBarColor = isDarkMode ? 'rgba(0, 184, 148, 0.8)' : 'var(--chart-output-color)';


        bandwidthChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Input', 'Output'],
                datasets: [{
                    label: 'Bandwidth (Gbps)',
                    data: [inputGbps, outputGbps],
                    backgroundColor: [inputBarColor, outputBarColor],
                    borderColor: [inputBarColor, outputBarColor],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: false, /* Title is now in card-title */
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Gbps',
                            color: textColor
                        },
                        ticks: {
                            color: textColor
                        },
                        grid: {
                            color: gridColor
                        }
                    },
                    x: {
                        ticks: {
                            color: textColor
                        },
                        grid: {
                            color: gridColor
                        }
                    }
                }
            }
        });
    },

    
    
    toggleDarkMode: function () {
        document.body.classList.toggle('dark');
        const isDarkMode = document.body.classList.contains('dark');
        const iconSpan = document.querySelector('#darkModeToggle .icon')
        const srOnlySpan = document.querySelector('#darkModeToggle .sr-only');

        iconSpan.textContent = isDarkMode ? '☀️' : '🌙';
        srOnlySpan.textContent = isDarkMode ? 'Toggle Light Mode' : 'Toggle Dark Mode';
        this.elements.darkModeToggle.setAttribute('aria-pressed', isDarkMode);
        this.elements.darkModeToggle.dataset.darkmode = isDarkMode;

        if (bandwidthChartInstance) {
            const textColor = isDarkMode ? 'var(--chart-text-color-dark)' : 'var(--chart-text-color-light)';
            const gridColor = isDarkMode ? 'var(--chart-grid-color-dark)' : 'var(--chart-grid-color-light)';
            const inputBarColor = isDarkMode ? 'rgba(116, 185, 255, 0.8)' : 'var(--chart-input-color)';
            const outputBarColor = isDarkMode ? 'rgba(0, 184, 148, 0.8)' : 'var(--chart-output-color)';

            bandwidthChartInstance.options.scales.y.title.color = textColor;
            bandwidthChartInstance.options.scales.y.ticks.color = textColor;
            bandwidthChartInstance.options.scales.y.grid.color = gridColor;
            bandwidthChartInstance.options.scales.x.ticks.color = textColor;
            bandwidthChartInstance.options.scales.x.grid.color = gridColor;
            bandwidthChartInstance.data.datasets[0].backgroundColor = [inputBarColor, outputBarColor];
            bandwidthChartInstance.data.datasets[0].borderColor = [inputBarColor, outputBarColor];
            bandwidthChartInstance.update();
        }
    },



    // Auto dark mode detection on load
    
    
    initDarkMode: function () {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const isDark = prefersDark;

        if (isDark) {
            document.body.classList.add('dark');
            this.elements.darkModeToggle.setAttribute('aria-pressed', 'true');
            this.elements.darkModeToggle.dataset.darkmode = 'true';
            document.querySelector('#darkModeToggle .icon').textContent = '☀️';
            document.querySelector('#darkModeToggle .sr-only').textContent = 'Toggle Light Mode';
        } else {
            document.body.classList.remove('dark');
            this.elements.darkModeToggle.setAttribute('aria-pressed', 'false');
            this.elements.darkModeToggle.dataset.darkmode = 'false';
            document.querySelector('#darkModeToggle .icon').textContent = '🌙';
            document.querySelector('#darkModeToggle .sr-only').textContent = 'Toggle Dark Mode';
        }
    },


};

// Fungsi bantu: validasi angka positif tanpa huruf
function isValidPositiveNumber(value) {
    return /^[0-9]+(\.[0-9]+)?$/.test(value.trim()) && parseFloat(value) > 0;
}

// Main Functions
function calculateRealtime() {
    console.log('calculateRealtime() called');
    UIController.showLoading();

    try {
        // Ambil nilai dari form
        const inputRateValue = UIController.elements.inputRateValue.value.trim();
        const outputRateValue = UIController.elements.outputRateValue.value.trim();
        const portCapacityValue = UIController.elements.portCapacity.value.trim();

        // Validasi: Tidak boleh kosong
        if (!inputRateValue || !outputRateValue || !portCapacityValue) {
            alert('⚠️ Silakan isi semua kolom bandwidth terlebih dahulu.');
            UIController.hideLoading();
            return;
        }

        // Validasi: Semua harus angka positif tanpa huruf
        if (
            !isValidPositiveNumber(inputRateValue) ||
            !isValidPositiveNumber(outputRateValue) ||
            !isValidPositiveNumber(portCapacityValue)
        ) {
            alert('⚠️ Input tidak valid. Gunakan angka positif tanpa huruf.');
            UIController.hideLoading();
            return;
        }

        // Konversi ke float
        const inputRate = parseFloat(inputRateValue);
        const outputRate = parseFloat(outputRateValue);
        const portCapacity = parseFloat(portCapacityValue);

        // Ambil unit
        const inputRateUnit = UIController.elements.inputRateUnit.value;
        const outputRateUnit = UIController.elements.outputRateUnit.value;

        // Konversi ke bps
        const inputBps = Utils.convertRateToBps(inputRate, inputRateUnit);
        const outputBps = Utils.convertRateToBps(outputRate, outputRateUnit);

        // Proses analisis
        const analyzer = new TrafficAnalyzer(inputBps, outputBps, portCapacity);
        currentAnalysis = analyzer;

        setTimeout(() => {
            UIController.renderResults(analyzer);
            UIController.hideLoading();
        }, 500);

    } catch (error) {
        console.error('⚠️ Kalkulasi Gagal:', error);
        alert(error.message);
        UIController.hideLoading();
    }
}



//export to excel
function exportToCSV() {
    if (!currentAnalysis) {
        alert('Tidak ada data analisis yang dapat diekspor. Jalankan analisis terlebih dahulu.');
        return;
    }

    const report = currentAnalysis.generateReport();
    let csvContent = "data:text/csv;charset=utf-8,";

    const headers = [
        ["QCNet Bandwidth Analysis Report"],
        [`Timestamp: ${report.timestamp}`],
        [],
        ["Metric", "Value", "Unit", "Notes"]
    ];

    const rows = [
        ["Input Rate", Utils.formatNumber(report.input.gbps), "Gbps", "Download average rate"],
        ["Output Rate", Utils.formatNumber(report.output.gbps), "Gbps", "Upload average rate"],
        ["Total Rate", Utils.formatNumber(report.total.gbps), "Gbps", "Combined input/output"],
        ["Utilization", Utils.formatNumber(report.total.utilization), "%", Utils.getUtilizationText(report.total.utilization)],
        ["Port Capacity", Utils.formatNumber(report.port.capacity), "Gbps", report.port.type],
        ["Available Capacity", Utils.formatNumber(report.analysis.availableBandwidth), "Gbps", "Remaining usable bandwidth"],
        ["Traffic Pattern", report.analysis.pattern, "", ""],
        ["Recommendation", report.analysis.recommendation, "", ""]
    ];

    headers.forEach(row => {
        csvContent += row.join(",") + "\n"; // FIXED HERE
    });

    rows.forEach(row => {
        csvContent += row.join(",") + "\n"; // FIXED HERE
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `bandwidth_report_qcnet_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}



// Event Listeners (better than inline onclick)
document.addEventListener('DOMContentLoaded', () => {
    UIController.initDarkMode(); // Initialize dark mode on load
    UIController.elements.analyzeButton.addEventListener('click', calculateRealtime);
    UIController.elements.exportButton.addEventListener('click', exportToCSV);
    UIController.elements.darkModeToggle.addEventListener('click', UIController.toggleDarkMode);
});
