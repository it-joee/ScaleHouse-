import fs from "node:fs";

const text = fs.readFileSync("/workspace/attachments/AppSheet.ViewData.2026-10-13.csv", "utf8");

function parseCsv(csv) {
  const rows = [];
  let row = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < csv.length; i += 1) {
    const c = csv[i];
    if (q) {
      if (c === '"' && csv[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(cur);
      cur = "";
    } else if (c === "\n") {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else if (c !== "\r") cur += c;
  }
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

function parseDate(s) {
  const t = (s || "").trim();
  if (!t) return null;
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const mo = Number(m[1]);
  const da = Number(m[2]);
  const yr = Number(m[3]);
  if (mo < 1 || mo > 12 || da < 1 || da > 31) return null;
  return `${yr}-${String(mo).padStart(2, "0")}-${String(da).padStart(2, "0")}`;
}

function parseNum(s) {
  const t = (s || "").trim();
  if (!t) return null;
  const n = Number(t.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function sqlStr(s) {
  return `'${String(s ?? "").replace(/'/g, "''")}'`;
}
function sqlNum(n) {
  return n === null || n === undefined ? "NULL" : String(n);
}
function sqlDate(iso) {
  return iso ? `'${iso}'` : "NULL";
}
function normPlate(s) {
  return String(s || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

const COMPANY = {
  "JNI AGRI LTD": "jni",
  "FRONTIER AGRITRADE LTD": "frontier",
  "ROYAL SANRICS": "royal",
  "YUSIDEL VENTURES": "yusidel",
  "HUMBLE DRIVE ENTERPRISES": "humble",
  "HAVILLAH PRECIOUS LTD": "havillah",
  "": "unassigned",
};

const rows = parseCsv(text).slice(1).filter((r) => r.length > 5);
const lines = [];
lines.push("-- Imported from the AppSheet master log export (13 Oct 2026).");
lines.push("insert into companies (id, name, code, active, sort_order) values");
lines.push("  ('jni', 'JNI AGRI LTD', 'JNI', true, 10),");
lines.push("  ('frontier', 'FRONTIER AGRITRADE LTD', 'FRT', true, 20),");
lines.push("  ('royal', 'ROYAL SANRICS', 'RSL', true, 30),");
lines.push("  ('yusidel', 'YUSIDEL VENTURES', 'YUS', true, 40),");
lines.push("  ('humble', 'HUMBLE DRIVE ENTERPRISES', 'HDE', true, 50),");
lines.push("  ('havillah', 'HAVILLAH PRECIOUS LTD', 'HAV', true, 60),");
lines.push("  ('unassigned', 'Unassigned', 'UNX', true, 900)");
lines.push("on conflict (id) do nothing;");
lines.push("");

rows.forEach((r, i) => {
  const companyName = (r[0] || "").trim();
  const companyId = COMPANY[companyName];
  if (!companyId) throw new Error(`Unknown company: ${companyName}`);
  const logged = parseDate(r[1]);
  const deliveredRaw = (r[16] || "").trim();
  const delivered = parseDate(deliveredRaw);
  const offloaded = parseDate(r[18]);
  const created = parseDate(r[22]);
  const modified = parseDate(r[24]);
  let comment = (r[19] || "").trim();
  if (deliveredRaw && !delivered) {
    comment = [comment, `[Date delivered field: ${deliveredRaw}]`].filter(Boolean).join(" ");
  }
  const statusRaw = (r[17] || "").trim().toLowerCase();
  let status = "pending";
  if (statusRaw === "offloaded" || (!statusRaw && offloaded)) status = "offloaded";
  else if (statusRaw === "pending" || !statusRaw) status = "pending";
  else status = "pending";

  const truck = (r[3] || "").trim();
  const truckNorm = normPlate(r[4] || "") || normPlate(truck);
  const id = `imp-${String(i + 1).padStart(3, "0")}`;
  const at = created || logged;
  const atSql = at ? `'${at} 08:00:00+00'` : "now()";
  const actor = (r[21] || "").trim() || "AppSheet";

  lines.push(
    `insert into deliveries (id, company_id, logged_on, waybill, truck_number, truck_norm, commodity_id, declared_mt, sgs_mt, contract_qty_mt, contract_bal_mt, driver_name, driver_contact, origin, supplier_name, supplier_contact, warehouse, delivered_on, status, offloaded_on, comment, officer, purchase_price_mt, photo_url, created_by, created_at, modified_by, modified_at) values (` +
      [
        sqlStr(id),
        sqlStr(companyId),
        sqlDate(logged),
        sqlStr((r[2] || "").trim()),
        sqlStr(truck),
        sqlStr(truckNorm),
        sqlStr("shea"),
        sqlNum(parseNum(r[6])),
        sqlNum(parseNum(r[7])),
        sqlNum(parseNum(r[8])),
        sqlNum(parseNum(r[9])),
        sqlStr((r[10] || "").trim()),
        sqlStr((r[11] || "").trim()),
        sqlStr((r[12] || "").trim()),
        sqlStr((r[13] || "").trim()),
        sqlStr((r[14] || "").trim()),
        sqlStr((r[15] || "").trim()),
        sqlDate(delivered),
        sqlStr(status),
        sqlDate(offloaded),
        sqlStr(comment),
        sqlStr((r[20] || "").trim()),
        sqlNum(parseNum(r[26])),
        sqlStr((r[25] || "").trim()),
        sqlStr(actor),
        atSql,
        sqlStr((r[23] || "").trim()),
        modified ? `'${modified} 08:00:00+00'` : atSql,
      ].join(", ") +
      ") on conflict (id) do nothing;",
  );
  lines.push(
    `insert into audit_events (id, delivery_id, at, actor_user_id, actor_name, action, detail) values (` +
      [
        sqlStr(`aud-${String(i + 1).padStart(3, "0")}`),
        sqlStr(id),
        atSql,
        sqlStr("import"),
        sqlStr(actor),
        sqlStr("Imported"),
        sqlStr("Brought across from the AppSheet master log."),
      ].join(", ") +
      ") on conflict (id) do nothing;",
  );
});

fs.writeFileSync("/workspace/migrations/0003_seed.sql", `${lines.join("\n")}\n`);
console.log(`wrote ${rows.length} deliveries`);
