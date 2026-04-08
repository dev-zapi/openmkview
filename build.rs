use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

fn main() {
    let git_hash = Command::new("git")
        .args(["rev-parse", "HEAD"])
        .output()
        .ok()
        .and_then(|output| {
            if output.status.success() {
                Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
            } else {
                None
            }
        })
        .unwrap_or_else(|| "unknown".to_string());

    let short_hash = if git_hash != "unknown" {
        &git_hash[..7.min(git_hash.len())]
    } else {
        &git_hash
    };

    let build_time = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| {
            let secs = d.as_secs();
            let days = secs / 86400;
            let years = 1970 + days / 365;
            let remaining_days = days % 365;
            let months = remaining_days / 30 + 1;
            let day = remaining_days % 30 + 1;
            let hours = (secs % 86400) / 3600;
            let minutes = (secs % 3600) / 60;
            let seconds = secs % 60;
            format!(
                "{}-{:02}-{:02} {:02}:{:02}:{:02}",
                years, months, day, hours, minutes, seconds
            )
        })
        .unwrap_or_else(|_| "unknown".to_string());

    println!("cargo:rustc-env=GIT_HASH={}", git_hash);
    println!("cargo:rustc-env=GIT_SHORT_HASH={}", short_hash);
    println!("cargo:rustc-env=BUILD_TIME={}", build_time);

    println!("cargo:rerun-if-changed=.git/HEAD");
    println!("cargo:rerun-if-changed=.git/refs/heads/");
}
