export const PANEL_CSS = `
:host { all: initial; }
.aj-root, .aj-root * { box-sizing: border-box; }
.aj-root {
  font-family: "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", -apple-system, sans-serif;
  color: #18202f;
  font-size: 13px;
  line-height: 1.5;
}
.aj-root button, .aj-root input, .aj-root textarea, .aj-root select { font: inherit; color: inherit; }
.aj-root a { color: #1f5eff; text-decoration: none; }

.aj-launcher {
  position: fixed; right: 22px; bottom: 22px; width: 54px; height: 54px;
  border: 0; border-radius: 50%; cursor: pointer; pointer-events: auto;
  background: linear-gradient(135deg, #1f5eff 0%, #7c5cff 100%);
  color: #fff; font-weight: 800; font-size: 15px; letter-spacing: .5px;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 12px 32px rgba(31, 94, 255, .42), 0 2px 6px rgba(20, 30, 55, .18);
  transition: transform .16s ease, box-shadow .16s ease;
  z-index: 2147483646;
}
.aj-launcher:hover { transform: translateY(-2px) scale(1.03); box-shadow: 0 16px 38px rgba(31,94,255,.5); }
.aj-launcher-badge {
  position: absolute; top: -2px; right: -2px; min-width: 18px; height: 18px; padding: 0 4px;
  border-radius: 999px; background: #ff5a5f; color: #fff; font-size: 10px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; border: 2px solid #fff;
}

.aj-panel {
  position: fixed; top: 14px; right: 14px; bottom: 14px; width: 408px;
  max-width: calc(100vw - 20px); background: #fff; border-radius: 18px;
  box-shadow: 0 28px 90px rgba(15, 23, 42, .34), 0 2px 8px rgba(15,23,42,.1);
  display: flex; flex-direction: column; overflow: hidden; pointer-events: auto;
  z-index: 2147483647; animation: aj-slide-in .2s cubic-bezier(.2,.7,.3,1);
}
@keyframes aj-slide-in { from { opacity: 0; transform: translateX(16px); } }

.aj-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 14px; border-bottom: 1px solid #edf0f6; }
.aj-brand { display: flex; align-items: center; gap: 9px; min-width: 0; }
.aj-logo {
  width: 32px; height: 32px; border-radius: 10px; flex: none;
  background: linear-gradient(135deg, #1f5eff 0%, #7c5cff 100%);
  color: #fff; font-weight: 800; font-size: 12px; display: grid; place-items: center;
  box-shadow: 0 4px 12px rgba(31,94,255,.28);
}
.aj-brand b { display: block; font-size: 13.5px; letter-spacing: -.2px; white-space: nowrap; }
.aj-brand span { display: block; font-size: 10.5px; color: #8a92a2; margin-top: 1px; white-space: nowrap; }
.aj-head-actions { display: flex; align-items: center; gap: 2px; }
.aj-icon-btn {
  width: 28px; height: 28px; border: 0; background: transparent; border-radius: 8px;
  color: #7d8595; display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
}
.aj-icon-btn:hover { background: #f2f4f9; color: #18202f; }

.aj-status {
  display: flex; align-items: center; gap: 7px; padding: 7px 14px;
  background: #fbfcff; border-bottom: 1px solid #f0f2f7; font-size: 10.5px; color: #7c8494;
  flex-wrap: wrap; min-height: 30px;
}
.aj-dot { width: 6px; height: 6px; border-radius: 50%; background: #22b573; flex: none; box-shadow: 0 0 0 3px #e6f7ef; }
.aj-dot.error { background: #e5484d; box-shadow: 0 0 0 3px #fdeeee; }
.aj-dot.checking { background: #d7a20a; box-shadow: 0 0 0 3px #fff7e6; }
.aj-status-warn { color: #a96500; background: #fff7e6; border-radius: 4px; padding: 1px 6px; }

.aj-tabs { display: flex; align-items: stretch; padding: 0 14px; border-bottom: 1px solid #edf0f6; flex: none; }
.aj-tab {
  position: relative; border: 0; background: transparent; padding: 10px 4px 9px; margin-right: 18px;
  font-size: 12.5px; color: #7b8393; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;
}
.aj-tab.active { color: #18202f; font-weight: 650; }
.aj-tab.active::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; background: #1f5eff; border-radius: 2px; }
.aj-tab .aj-count { min-width: 15px; height: 15px; padding: 0 4px; border-radius: 999px; background: #ff5a5f; color: #fff; font-size: 9px; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; }

.aj-body { flex: 1; overflow-y: auto; padding: 12px 14px 16px; display: flex; flex-direction: column; gap: 11px; }
.aj-body::-webkit-scrollbar { width: 6px; }
.aj-body::-webkit-scrollbar-thumb { background: #d9dee9; border-radius: 999px; }
.aj-footer { flex: none; border-top: 1px solid #edf0f6; padding: 10px 14px; background: #fbfcff; display: flex; gap: 7px; align-items: center; }
.aj-footer .aj-grow { flex: 1; }

.aj-card { border: 1px solid #e8ebf2; border-radius: 12px; padding: 11px 12px; background: #fff; }
.aj-card.flat { background: #fafbfe; }
.aj-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.aj-card-head h3 { margin: 0; font-size: 12.5px; font-weight: 700; }
.aj-card-head .aj-muted { margin-top: 1px; }
.aj-muted { color: #7d8595; font-size: 10.5px; }
.aj-title { font-size: 15px; font-weight: 750; letter-spacing: -.3px; line-height: 1.35; }
.aj-company { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 4px; font-size: 11.5px; color: #5d6576; }
.aj-salary { color: #d4573b; font-weight: 650; font-size: 12px; }
.aj-tags { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 8px; }
.aj-tag { font-size: 10px; padding: 2px 6px; border-radius: 4px; background: #f2f4f9; color: #697182; border: 1px solid #edf0f6; }
.aj-tag.blue { background: #eef3ff; color: #2453c7; border-color: #dce6ff; }

.aj-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 5px;
  border: 1px solid transparent; border-radius: 8px; cursor: pointer; font-weight: 600;
  padding: 0 11px; height: 32px; font-size: 12px; line-height: 1; white-space: nowrap;
  transition: background .15s, border-color .15s, color .15s; user-select: none;
}
.aj-btn:disabled { opacity: .5; cursor: not-allowed; }
.aj-btn-primary { background: #1f5eff; color: #fff; box-shadow: 0 4px 12px rgba(31,94,255,.2); }
.aj-btn-primary:hover:not(:disabled) { background: #184fda; }
.aj-btn-secondary { background: #fff; border-color: #d7dde9; color: #465063; }
.aj-btn-secondary:hover:not(:disabled) { border-color: #b9c9f5; color: #1f5eff; background: #f8faff; }
.aj-btn-soft { background: #eef3ff; color: #1f5eff; }
.aj-btn-soft:hover:not(:disabled) { background: #e2ecff; }
.aj-btn-ghost { background: transparent; color: #6b7384; }
.aj-btn-ghost:hover:not(:disabled) { background: #f2f4f9; color: #18202f; }
.aj-btn-sm { height: 28px; padding: 0 8px; font-size: 11px; border-radius: 7px; }
.aj-btn-block { width: 100%; }
.aj-btn-danger { background: #fdeeee; color: #c22f35; }
.aj-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.aj-row-between { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.aj-grow { flex: 1; min-width: 0; }

.aj-input, .aj-textarea, .aj-select {
  width: 100%; border: 1px solid #d7dde9; border-radius: 8px; background: #fff;
  padding: 7px 9px; font-size: 12px; outline: none; transition: border-color .15s, box-shadow .15s;
}
.aj-input { height: 32px; }
.aj-select { height: 32px; }
.aj-textarea { resize: vertical; min-height: 70px; line-height: 1.6; }
.aj-input:focus, .aj-textarea:focus, .aj-select:focus { border-color: #1f5eff; box-shadow: 0 0 0 3px rgba(31,94,255,.1); }
.aj-field { display: flex; flex-direction: column; gap: 4px; }
.aj-field > span { font-size: 11px; color: #5d6576; font-weight: 600; }
.aj-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.aj-hint { font-size: 10px; color: #8a92a2; line-height: 1.5; }
.aj-error { color: #dc3d43; font-size: 11px; line-height: 1.5; }

.aj-notice { display: flex; gap: 8px; align-items: flex-start; padding: 9px 10px; border-radius: 9px; font-size: 11px; line-height: 1.55; }
.aj-notice svg { flex: none; margin-top: 1px; }
.aj-notice.info { background: #f5f8ff; border: 1px solid #dce6ff; color: #44557a; }
.aj-notice.warn { background: #fffbf0; border: 1px solid #f3e2b5; color: #7d5b13; }
.aj-notice.error { background: #fdf1f1; border: 1px solid #f4d4d5; color: #9c3035; }
.aj-notice b { display: block; font-size: 11.5px; margin-bottom: 1px; }

.aj-auto-card {
  border: 1px solid #cfdcff; border-radius: 12px; padding: 11px 12px;
  background: linear-gradient(135deg, #f8faff, #eef3ff);
}
.aj-auto-card.stage-done { border-color: #ccebd9; background: linear-gradient(135deg, #f7fcf9, #eefaf3); }
.aj-auto-card.stage-skipped { border-color: #e5e9f1; background: #fafbfe; }
.aj-auto-card.stage-error { border-color: #f2d3d4; background: #fdf6f6; }
.aj-auto-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.aj-auto-title { display: flex; align-items: center; gap: 6px; font-size: 12px; min-width: 0; }
.aj-auto-title svg { color: #1f5eff; flex: none; }
.aj-auto-card.stage-done .aj-auto-title svg { color: #12995a; }
.aj-auto-card.stage-error .aj-auto-title svg { color: #dc3d43; }
.aj-auto-card.stage-skipped .aj-auto-title svg { color: #8a92a2; }
.aj-auto-message { margin: 6px 0 0; font-size: 11px; line-height: 1.55; color: #4b5568; }
.aj-auto-countdown { display: flex; align-items: baseline; gap: 5px; margin-top: 6px; }
.aj-auto-countdown b { font-size: 23px; line-height: 1; color: #1f5eff; font-weight: 800; }
.aj-auto-countdown span { font-size: 10.5px; color: #6b7486; }

.aj-score-row { display: flex; gap: 12px; align-items: center; padding: 10px; border-radius: 10px; background: linear-gradient(135deg, #f8faff, #f1f5ff); border: 1px solid #e3e9f7; }
.aj-score-ring { width: 58px; height: 58px; border-radius: 50%; display: grid; place-items: center; flex: none; }
.aj-score-inner { width: 46px; height: 46px; border-radius: 50%; background: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1; }
.aj-score-inner b { font-size: 17px; font-weight: 750; }
.aj-score-inner span { font-size: 8px; color: #8a92a2; margin-top: 2px; }
.aj-verdict { display: inline-flex; align-items: center; border-radius: 999px; padding: 2px 7px; font-size: 10px; font-weight: 650; }
.aj-verdict.green { background: #e9f8ef; color: #0e7c4a; }
.aj-verdict.blue { background: #edf3ff; color: #1e50d8; }
.aj-verdict.amber { background: #fff7e6; color: #a96500; }
.aj-verdict.red { background: #fdeeee; color: #c22f35; }
.aj-summary { margin: 4px 0 0; font-size: 11.5px; color: #454d5c; line-height: 1.6; }
.aj-two { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.aj-mini { border-radius: 8px; padding: 8px 9px; font-size: 10.5px; }
.aj-mini.green { background: #f4fbf7; border: 1px solid #d9f0e2; }
.aj-mini.amber { background: #fffbf2; border: 1px solid #f4e6c8; }
.aj-mini b { display: block; font-size: 10.5px; margin-bottom: 3px; }
.aj-dot-list { margin: 0; padding-left: 13px; }
.aj-dot-list li { margin: 2px 0; line-height: 1.5; color: #4b5360; }
.aj-dot-list li::marker { color: #9aa7c7; }
.aj-keywords { display: flex; gap: 4px; flex-wrap: wrap; }
.aj-keyword { font-size: 10px; padding: 2px 6px; background: #f2f5fa; border: 1px solid #e7ebf2; border-radius: 4px; color: #596273; }
.aj-details { border-top: 1px dashed #edf0f6; padding-top: 8px; }
.aj-details summary { cursor: pointer; font-size: 10.5px; color: #7d8595; }
.aj-details > div { margin-top: 6px; font-size: 11px; color: #4b5360; line-height: 1.6; }

.aj-meter { height: 4px; border-radius: 999px; background: #edf0f6; overflow: hidden; margin-top: 6px; }
.aj-meter span { display: block; height: 100%; background: linear-gradient(90deg, #1f5eff, #7c5cff); border-radius: 999px; transition: width .3s; }
.aj-char { font-size: 10px; color: #8a92a2; text-align: right; margin-top: 3px; }
.aj-greeting { font-size: 12px; line-height: 1.65; }
.aj-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.aj-summary-line { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.aj-badge { display: inline-flex; align-items: center; gap: 3px; padding: 2px 7px; border-radius: 999px; font-size: 10px; font-weight: 600; }
.aj-badge.green { background: #e9f8ef; color: #0e7c4a; }
.aj-badge.blue { background: #edf3ff; color: #1e50d8; }
.aj-badge.gray { background: #f2f4f8; color: #5c6474; }
.aj-badge.amber { background: #fff7e6; color: #a96500; }

.aj-chat-current { display: flex; gap: 8px; align-items: center; padding: 8px 9px; background: #f7f9ff; border: 1px solid #e1e8ff; border-radius: 9px; }
.aj-avatar { width: 28px; height: 28px; border-radius: 50%; background: #e8eeff; color: #2453c7; display: grid; place-items: center; font-size: 11px; font-weight: 700; flex: none; }
.aj-messages { display: flex; flex-direction: column; gap: 6px; max-height: 210px; overflow-y: auto; padding: 2px; }
.aj-msg { max-width: 88%; font-size: 11px; line-height: 1.55; }
.aj-msg span { display: block; font-size: 9px; color: #8a92a2; margin-bottom: 2px; }
.aj-msg p { margin: 0; background: #f2f4f8; padding: 7px 9px; border-radius: 8px; white-space: pre-wrap; color: #3d4554; }
.aj-msg.me { align-self: flex-end; text-align: right; }
.aj-msg.me p { background: #eef3ff; color: #27488f; text-align: left; }
.aj-reply-box { background: #f7f9ff; border: 1px solid #dce5ff; border-radius: 10px; padding: 9px 10px; }
.aj-reply-box textarea { background: #fff; }
.aj-chat-item { border: 1px solid #edf0f6; border-radius: 9px; padding: 9px; margin-top: 7px; }
.aj-chat-item:first-child { margin-top: 0; }
.aj-chat-item p { margin: 4px 0; font-size: 11px; color: #4b5360; line-height: 1.55; }
.aj-chat-item .aj-muted { display: block; margin-top: 1px; }

.aj-empty { text-align: center; padding: 22px 12px; color: #8a92a2; font-size: 11px; }
.aj-empty svg { color: #b6bdca; margin-bottom: 6px; }
.aj-empty b { display: block; color: #5d6576; font-size: 12px; margin-bottom: 3px; }
.aj-loading { display: flex; align-items: center; justify-content: center; gap: 7px; padding: 22px; color: #7d8595; font-size: 11px; }
.aj-spin { animation: aj-spin 1s linear infinite; }
@keyframes aj-spin { to { transform: rotate(360deg); } }

.aj-toast {
  position: absolute; left: 14px; right: 14px; bottom: 64px; z-index: 5;
  background: #141b28; color: #f5f7fb; border-radius: 9px; padding: 9px 11px;
  font-size: 11px; line-height: 1.5; box-shadow: 0 10px 30px rgba(10,18,35,.25);
  animation: aj-fade .16s ease;
}
.aj-toast.success { border-left: 3px solid #3dd68c; }
.aj-toast.error { border-left: 3px solid #ff6b6b; }
.aj-toast.info { border-left: 3px solid #6ea0ff; }
@keyframes aj-fade { from { opacity: 0; transform: translateY(4px); } }

.aj-connect { padding: 18px 4px; }
.aj-connect h3 { margin: 0 0 5px; font-size: 14px; }
.aj-connect p { margin: 0 0 12px; font-size: 11px; color: #7d8595; line-height: 1.65; }
.aj-code { font-family: Consolas, monospace; background: #f1f4fa; border-radius: 4px; padding: 1px 5px; font-size: 10px; color: #34405c; }

.aj-footer .aj-btn-primary { height: 36px; font-size: 12.5px; }
.aj-footer-meta { font-size: 9.5px; color: #8a92a2; line-height: 1.4; }

@media (max-width: 520px) {
  .aj-panel { top: 8px; right: 8px; bottom: 8px; width: calc(100vw - 16px); border-radius: 14px; }
  .aj-launcher { right: 16px; bottom: 16px; }
  .aj-two { grid-template-columns: 1fr; }
  .aj-grid-2 { grid-template-columns: 1fr; }
}
`;
