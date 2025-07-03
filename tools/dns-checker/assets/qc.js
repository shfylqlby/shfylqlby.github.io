function goBack() {
  window.history.back();
}

async function getIPInfo() {
  const ipInfoEl = document.getElementById('ip-result');
  try {
    const res = await fetch('https://ipinfo.io/json');
    const data = await res.json();
    const ptrRes = await getPTR(data.ip);
    const info = `Your IP: ${data.ip}\nASN: ${data.org}\nLocation: ${data.city}, ${data.region}, ${data.country}\nPTR: ${ptrRes}`;
    ipInfoEl.textContent = info;
    return data;
  } catch (err) {
    ipInfoEl.textContent = 'Failed to fetch IP info';
    return null;
  }
}

async function getPTR(ip) {
  if (!ip) return 'No IP';
  const reversed = ip.includes(':')
    ? ip.split(':').reverse().join('.') + '.ip6.arpa'
    : ip.split('.').reverse().join('.') + '.in-addr.arpa';
  const url = `https://cloudflare-dns.com/dns-query?name=${reversed}&type=PTR`;
  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/dns-json' }
    });
    const json = await res.json();
    return json.Answer?.[0]?.data?.replace(/\.$/, '') || 'No PTR record';
  } catch (err) {
    return 'Failed to resolve PTR';
  }
}

async function getECSInfo(ip, baseData) {
  const ecsEl = document.getElementById('ecs-result');
  if (!ip || !baseData) return ecsEl.textContent = 'No IP';
  try {
    const isIPv6 = ip.includes(':');
    let subnet = ip;
    if (!isIPv6) {
      const ipParts = ip.split('.');
      ipParts[3] = '0';
      subnet = ipParts.join('.') + '/24';
    } else {
      subnet = ip.split(':').slice(0, 4).join(':') + '::/64';
    }

    const traceRes = await fetch('https://cloudflare-dns.com/cdn-cgi/trace');
    const traceText = await traceRes.text();
    const resolverIP = traceText.split('\n').find(line => line.startsWith('ip='))?.split('=')[1] || 'Unknown';

    let resolverPTR = await getPTR(resolverIP);
    let resolverInfo = '';
    try {
      const resolverGeo = await fetch(`https://ipinfo.io/${resolverIP}/json`);
      const resData = await resolverGeo.json();
      resolverInfo = `${resData.org}\n${resolverIP}\nptr: ${resolverPTR}\n${resData.city}, ${resData.region}, ${resData.country}`;
    } catch (e) {
      resolverInfo = `${resolverIP}\nptr: ${resolverPTR}`;
    }

    ecsEl.textContent = `Your DNS resolvers specify your IP subnet (ECS):\n${baseData.org}\n${subnet}\n${baseData.city}, ${baseData.region}, ${baseData.country}\n\nResolver Info:\n${resolverInfo}`;
  } catch (err) {
    ecsEl.textContent = 'Failed to fetch ECS info';
  }
}

async function checkDNSSEC() {
  const dnssecEl = document.getElementById('dnssec-result');
  const domain = 'dnssec-tools.org';
  const url = `https://cloudflare-dns.com/dns-query?name=${domain}&type=A&cd=false&do=true`;
  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/dns-json' }
    });
    const json = await res.json();
    if (json.AD) {
      dnssecEl.textContent = `✅ DNSSEC validated (${domain})`;
    } else {
      dnssecEl.textContent = `⚠️ DNSSEC not validated (${domain})`;
    }
  } catch (err) {
    dnssecEl.textContent = 'Failed to check DNSSEC';
  }
}

async function testResolver() {
  const resolverEl = document.getElementById('resolver-result');
  try {
    const domain = 'google.com';
    const t0 = performance.now();
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${domain}&type=A`, {
      headers: { 'Accept': 'application/dns-json' }
    });
    const t1 = performance.now();
    const json = await res.json();
    const ips = json.Answer?.map(ans => ans.data).join(', ');
    const rtt = Math.round(t1 - t0);
    resolverEl.textContent = `Queried ${domain} in ${rtt}ms\nAnswer: ${ips}`;
  } catch (err) {
    resolverEl.textContent = 'DNS Resolver test failed';
  }
}

(async function run() {
  const ipData = await getIPInfo();
  await getECSInfo(ipData?.ip, ipData);
  await checkDNSSEC();
  await testResolver();
})();
