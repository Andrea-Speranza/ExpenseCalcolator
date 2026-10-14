//! Shell nativa (Tauri 2): una finestra con la WebView del sistema che mostra la build di `apps/web`, letta
//! dai file inclusi nell'app tramite il protocollo interno di Tauri. Nessun server, nessuna rete
//! (PLANNING §7.2, ADR 0009). Tutta la logica sta nella UI in TypeScript: qui c'è solo l'avvio.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("impossibile avviare l'app");
}
