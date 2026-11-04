/**
 * Results receiver for the ML Classification & Regression Test.
 * Bound to the Google Sheet "ML Classification & Regression Test — Results".
 * Deployed as a Web App (Execute as: me, Who has access: Anyone).
 * app.js POSTs one JSON object per submitted test; each becomes one row.
 */
const SHEET_NAME = "Results";
const NUM_QUESTIONS = 30;

function headers_() {
  const h = ["Submitted at", "Name", "Group", "Score (%)", "Correct", "Total", "Topics"];
  for (let i = 1; i <= NUM_QUESTIONS; i++) h.push("Q" + i);
  return h;
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME, 0);
  if (sh.getLastRow() === 0) {
    sh.appendRow(headers_());
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers_().length).setFontWeight("bold");
  }
  return sh;
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const d = JSON.parse(e.postData.contents);
    // answers arrive as "1:A,2:C,3:-" -> one column per question
    const byQ = {};
    String(d.answers || "").split(",").forEach(function (p) {
      const kv = p.split(":");
      if (kv.length === 2) byQ[kv[0]] = kv[1];
    });
    const row = [new Date(), String(d.name || ""), String(d.group || ""),
                 Number(d.percent), Number(d.correct), Number(d.total), String(d.topics || "")];
    for (let i = 1; i <= NUM_QUESTIONS; i++) row.push(byQ[String(i)] || "-");
    sheet_().appendRow(row);
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return ContentService.createTextOutput("Results endpoint is running.");
}

/** Run once from the editor to create the header row. */
function setup() {
  sheet_();
}
