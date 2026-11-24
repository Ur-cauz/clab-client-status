"use strict";
const notice = document.querySelector("#notice");
const content = document.querySelector("#content");
const parts = /^#([a-f0-9]{32})\.([a-f0-9]{64})$/.exec(location.hash);
const bytes = hex => Uint8Array.from(hex.match(/../g), x => parseInt(x,16));
const when = ts => ts ? new Date(ts).toLocaleString() : "No record";
const hours = seconds => (seconds / 3600).toFixed(2) + " h";
function section(title, rows) {
  const box = document.createElement("section"), head = document.createElement("h2"), list = document.createElement("dl");
  head.textContent = title;
  for (const [label,value] of rows) {
    const row = document.createElement("div"), term = document.createElement("dt"), detail = document.createElement("dd");
    term.textContent = label; detail.textContent = value; row.append(term,detail); list.append(row);
  }
  box.append(head,list); return box;
}
async function refresh() {
  try {
    const options = {cache:"no-store", credentials:"omit", signal:AbortSignal.timeout(15000)};
    const primary = "https://api.github.com/repos/Ur-cauz/lab-status-data/contents/clients.json";
    let snapshot;
    try {
      const response = await fetch(primary, options);
      if (!response.ok) throw Error();
      const file = await response.json();
      snapshot = JSON.parse(atob(file.content));
    } catch {
      // Shared networks can hit the unauthenticated API quota. Raw CDN data can lag.
      const response = await fetch("https://raw.githubusercontent.com/Ur-cauz/lab-status-data/main/clients.json", options);
      if (!response.ok) throw Error();
      snapshot = await response.json();
    }
    const record = snapshot[parts[1]];
    if (!record) {content.replaceChildren();notice.textContent="This link is inactive or waiting for its first update.";return;}
    const encrypted = Uint8Array.from(atob(record), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey("raw",bytes(parts[2]),"AES-GCM",false,["decrypt"]);
    const plain = await crypto.subtle.decrypt({name:"AES-GCM",iv:encrypted.slice(0,12)},key,encrypted.slice(12));
    const d = JSON.parse(new TextDecoder().decode(plain));
    const stale = Date.now()/1000-d.at > 300;
    document.querySelector("#title").textContent=d.name;
    notice.textContent=(stale ? "Updates delayed · Last known state" : "Updated") + " · " + when(d.at*1000);
    const memory = n => n == null ? "Unavailable" : (n/1048576).toFixed(0)+" MiB";
    content.replaceChildren(section("Latest observation",[["Service state",d.state],["CPU",d.cpu == null ? "Unavailable" : d.cpu+"%"],["Memory",memory(d.ram)]]),
      section("Last seven days",[["Observed running",hours(d.up)],["Observed downtime",hours(d.down)],["Planned stops",hours(d.planned)],["Observation coverage",hours(d.up+d.down+d.planned)+" / 168 h"],["Docker automatic restarts observed",d.restarts],["Peak memory",memory(d.peak)]]),
      section("Daily history · India time",(d.days || []).map(day => [day.day, hours(day.up)+" running · "+hours(day.down)+" down · "+hours(day.planned)+" planned"])),
      section("Recovery",[["Latest completed backup",when(d.backup)],["Last checksum-verified restore",when(d.restore)]]));
  } catch { content.replaceChildren(); notice.textContent="Status unavailable. Check the full link or try again shortly."; }
}
if(parts) { const tick=async()=>{await refresh();setTimeout(tick,90000);};tick(); }
else notice.textContent="Open the full service link supplied by your hosting administrator.";
