// Nelle build di rilascio niente finestra della console su Windows: da non togliere.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    expense_calcolator_lib::run();
}
