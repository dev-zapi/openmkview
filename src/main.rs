use actix_web::{middleware::Logger, web, App, HttpServer};
use clap::{Args, Parser, Subcommand};
use openmkview::auth::{build_auth_state, resolve_auth_config, AuthMiddleware};
use openmkview::config::{
    default_timeout_minutes, hash_password, load_config, save_config, PasskeySiteFileConfig,
    PasskeysFileConfig, PasswordAlgorithm,
};
use openmkview::db::{init_db, ProjectRepository, SettingsRepository};
use openmkview::handlers::{
    auth_login, auth_logout, auth_status, auth_update_session_timeout, clear_trash, close_project,
    create_file, create_project, delete_custom_theme, delete_file, delete_from_trash, execute_git,
    get_branches, get_commits, get_file_at_ref, get_file_content, get_file_diff, get_file_tree,
    get_recent_projects, get_settings, get_tags, get_theme_css_content, get_trash_stats,
    get_version, install_custom_theme, list_projects, list_themes, list_trash, move_to_trash,
    open_project, passkey_delete, passkey_list, passkey_login_finish, passkey_login_start,
    passkey_register_finish, passkey_register_start, rename_file, resolve_path, restore_from_trash,
    save_file_content, search_favicons, serve_project_file, update_project, update_project_color,
    update_settings, validate_project,
};
use openmkview::passkey::{build_passkey_sites, build_passkey_state};
use openmkview::services::TrashService;
use openmkview::static_files;
use std::sync::{Arc, Mutex};

const DEBUG_LOG_FORMAT: &str = r#"=== HTTP Request ===
Method: %m
URI: %U
Version: %V
Query: %q
Peer: %a
Headers: %{Accept}i, %{User-Agent}i, %{Content-Type}i
=== HTTP Response ===
Status: %s
Size: %b bytes
Time: %T seconds"#;

use openmkview::AppState;

/// OpenMKView - Markdown file previewer
#[derive(Parser, Debug)]
#[command(name = "openmkview", about = "A Markdown file previewer with web UI")]
struct Cli {
    /// Print version information
    #[arg(short, long)]
    version: bool,

    #[command(subcommand)]
    command: Option<Command>,
}

#[derive(Subcommand, Debug)]
enum Command {
    Serve(ServeArgs),
    Config {
        #[command(subcommand)]
        action: ConfigAction,
    },
}

#[derive(Args, Debug, Clone)]
struct ServeArgs {
    /// Host address to bind
    #[arg(long, env = "OPENMKVIEW_HOST", default_value = "0.0.0.0")]
    host: String,

    /// Port to listen on
    #[arg(short, long, env = "OPENMKVIEW_PORT", default_value_t = 4567)]
    port: u16,

    /// Number of HTTP worker threads
    #[arg(long, env = "OPENMKVIEW_WORKERS")]
    workers: Option<usize>,

    /// Login username
    #[arg(long)]
    username: Option<String>,

    /// Login password
    #[arg(long)]
    password: Option<String>,
}

#[derive(Subcommand, Debug)]
enum ConfigAction {
    SetUser(SetUserArgs),
    SetTimeout(SetTimeoutArgs),
    AddPasskeySite(AddPasskeySiteArgs),
    RemovePasskeySite(RemovePasskeySiteArgs),
    Show,
}

#[derive(Args, Debug)]
struct SetUserArgs {
    #[arg(long)]
    username: String,

    #[arg(long)]
    password: Option<String>,

    #[arg(long, default_value_t = PasswordAlgorithm::Argon2)]
    algorithm: PasswordAlgorithm,
}

#[derive(Args, Debug)]
struct SetTimeoutArgs {
    minutes: u64,
}

#[derive(Args, Debug)]
struct AddPasskeySiteArgs {
    #[arg(short = 'i', long)]
    id: String,

    #[arg(short = 'o', long)]
    origin: String,

    #[arg(short = 'r', long = "rp-id")]
    rp_id: String,

    #[arg(short = 'n', long = "rp-name")]
    rp_name: Option<String>,
}

#[derive(Args, Debug)]
struct RemovePasskeySiteArgs {
    #[arg(short = 'i', long)]
    id: String,
}

fn configure_routes(cfg: &mut web::ServiceConfig) {
    cfg.route("/api/auth/status", web::get().to(auth_status))
        .route("/api/auth/login", web::post().to(auth_login))
        .route("/api/auth/logout", web::post().to(auth_logout))
        .route(
            "/api/auth/passkey/register/start",
            web::post().to(passkey_register_start),
        )
        .route(
            "/api/auth/passkey/register/finish",
            web::post().to(passkey_register_finish),
        )
        .route(
            "/api/auth/passkey/login/start",
            web::post().to(passkey_login_start),
        )
        .route(
            "/api/auth/passkey/login/finish",
            web::post().to(passkey_login_finish),
        )
        .route("/api/auth/passkey/list", web::get().to(passkey_list))
        .route("/api/auth/passkey/{id}", web::delete().to(passkey_delete))
        .route(
            "/api/auth/session-timeout",
            web::put().to(auth_update_session_timeout),
        )
        .route("/api/projects", web::get().to(list_projects))
        .route("/api/projects", web::post().to(create_project))
        .route("/api/projects/recent", web::get().to(get_recent_projects))
        .route("/api/projects/validate", web::post().to(validate_project))
        .route("/api/projects/open", web::post().to(open_project))
        .route("/api/projects/{id}/close", web::post().to(close_project))
        .route("/api/projects/{id}", web::put().to(update_project))
        .route(
            "/api/projects/{id}/color",
            web::put().to(update_project_color),
        )
        .route("/api/projects/resolve", web::post().to(resolve_path))
        .route("/api/files/tree", web::get().to(get_file_tree))
        .route("/api/files/content", web::get().to(get_file_content))
        .route("/api/files/content", web::put().to(save_file_content))
        .route("/api/files/raw", web::get().to(serve_project_file))
        .route("/api/files/favicons", web::get().to(search_favicons))
        .route("/api/files", web::post().to(create_file))
        .route("/api/files", web::put().to(rename_file))
        .route("/api/files", web::delete().to(delete_file))
        .route("/api/settings", web::get().to(get_settings))
        .route("/api/settings", web::put().to(update_settings))
        .route("/api/themes", web::get().to(list_themes))
        .route("/api/themes/install", web::post().to(install_custom_theme))
        .route("/api/themes/{id}/css", web::get().to(get_theme_css_content))
        .route("/api/themes/{id}", web::delete().to(delete_custom_theme))
        .route("/api/git", web::post().to(execute_git))
        .route("/api/git/commits", web::get().to(get_commits))
        .route("/api/git/branches", web::get().to(get_branches))
        .route("/api/git/tags", web::get().to(get_tags))
        .route("/api/git/diff", web::post().to(get_file_diff))
        .route("/api/git/file", web::get().to(get_file_at_ref))
        .route("/api/trash/move", web::post().to(move_to_trash))
        .route("/api/trash/restore", web::post().to(restore_from_trash))
        .route("/api/trash/item", web::delete().to(delete_from_trash))
        .route("/api/trash/clear", web::delete().to(clear_trash))
        .route("/api/trash/list", web::get().to(list_trash))
        .route("/api/trash/stats", web::get().to(get_trash_stats))
        .route("/", web::get().to(static_files::serve_index))
        .route("/{path:.*}", web::get().to(static_files::serve_static));
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("debug"));

    let cli = Cli::parse();

    if cli.version {
        let version = env!("CARGO_PKG_VERSION");
        let build_time = env!("BUILD_TIME");
        let git_hash = env!("GIT_SHORT_HASH");
        println!("openmkview {}", version);
        println!("Build Time: {}", build_time);
        println!("Git Commit: {}", git_hash);
        return Ok(());
    }

    match cli.command {
        Some(Command::Config { action }) => {
            if let Err(err) = handle_config_command(action) {
                eprintln!("{}", err);
                std::process::exit(1);
            }
            return Ok(());
        }
        Some(Command::Serve(args)) => run_server(args).await,
        None => run_server(CliWithServeDefaults::parse().serve).await,
    }
}

#[derive(Parser, Debug)]
struct CliWithServeDefaults {
    #[command(flatten)]
    serve: ServeArgs,
}

fn handle_config_command(action: ConfigAction) -> anyhow::Result<()> {
    match action {
        ConfigAction::SetUser(args) => {
            let mut config = load_config()?;
            let password = match args.password {
                Some(password) => password,
                None => rpassword::prompt_password("Password: ")?,
            };

            let password_hash = hash_password(&password, args.algorithm.clone())?;
            config.auth.username = Some(args.username);
            config.auth.password_hash = Some(password_hash);
            config.auth.algorithm = args.algorithm;
            save_config(&config)?;
            println!("用户认证配置已保存到配置文件");
        }
        ConfigAction::SetTimeout(args) => {
            let mut config = load_config()?;
            config.session.timeout_minutes = args.minutes.max(1);
            save_config(&config)?;
            println!("Session 超时已更新为 {} 分钟", args.minutes.max(1));
        }
        ConfigAction::AddPasskeySite(args) => {
            let mut config = load_config()?;
            let new_site = PasskeySiteFileConfig {
                id: args.id.trim().to_string(),
                origin: args.origin.trim().to_string(),
                rp_id: args.rp_id.trim().to_string(),
                rp_name: args
                    .rp_name
                    .map(|name| name.trim().to_string())
                    .filter(|name| !name.is_empty()),
            };

            if let Some(site) = config
                .passkeys
                .sites
                .iter_mut()
                .find(|site| site.id.trim() == new_site.id)
            {
                *site = new_site;
            } else {
                config.passkeys.sites.push(new_site);
            }
            config.passkeys.enabled = true;
            validate_passkey_config(&config.passkeys)?;
            save_config(&config)?;
            println!("Passkey 站点配置已保存到配置文件");
        }
        ConfigAction::RemovePasskeySite(args) => {
            let mut config = load_config()?;
            let target_id = args.id.trim();
            let before = config.passkeys.sites.len();
            config
                .passkeys
                .sites
                .retain(|site| site.id.trim() != target_id);
            if before == config.passkeys.sites.len() {
                anyhow::bail!("未找到 Passkey 站点: {}", target_id);
            }
            if config.passkeys.sites.is_empty() {
                config.passkeys.enabled = false;
            }
            validate_passkey_config(&config.passkeys)?;
            save_config(&config)?;
            println!("Passkey 站点已移除: {}", target_id);
        }
        ConfigAction::Show => {
            let config = load_config()?;
            let username = config.auth.username.unwrap_or_else(|| "<none>".to_string());
            let password_hash = config
                .auth
                .password_hash
                .map(|_| "<hidden>".to_string())
                .unwrap_or_else(|| "<none>".to_string());
            println!("[auth]");
            println!("username = {}", username);
            println!("password_hash = {}", password_hash);
            println!("algorithm = {}", config.auth.algorithm);
            println!();
            println!("[session]");
            println!("timeout_minutes = {}", config.session.timeout_minutes);
            println!(
                "secret_key = {}",
                if config.session.secret_key.is_some() {
                    "<hidden>"
                } else {
                    "<none>"
                }
            );
            println!();
            println!("[passkeys]");
            println!("enabled = {}", config.passkeys.enabled);
            if config.passkeys.sites.is_empty() {
                println!("sites = <none>");
            } else {
                for site in &config.passkeys.sites {
                    println!();
                    println!("[[passkeys.sites]]");
                    println!("id = {}", site.id);
                    println!("origin = {}", site.origin);
                    println!("rp_id = {}", site.rp_id);
                    println!(
                        "rp_name = {}",
                        site.rp_name.as_deref().unwrap_or("OpenMKView")
                    );
                }
            }
        }
    }

    Ok(())
}

fn validate_passkey_config(passkeys: &PasskeysFileConfig) -> anyhow::Result<bool> {
    build_passkey_sites(passkeys)?;

    let has_https_passkey_site = passkeys.sites.iter().any(|site| {
        site.origin
            .trim()
            .to_ascii_lowercase()
            .starts_with("https://")
    });
    let has_http_passkey_site = passkeys.sites.iter().any(|site| {
        site.origin
            .trim()
            .to_ascii_lowercase()
            .starts_with("http://")
    });
    if has_http_passkey_site && has_https_passkey_site {
        anyhow::bail!("Passkey 站点不能同时混用 HTTP 和 HTTPS，请统一协议配置");
    }

    Ok(has_https_passkey_site)
}

async fn run_server(args: ServeArgs) -> std::io::Result<()> {
    let config = load_config().map_err(std::io::Error::other)?;

    let db_path = if let Ok(path) = std::env::var("OPENMKVIEW_DB_PATH") {
        std::path::PathBuf::from(path)
    } else {
        let data_dir = dirs::data_local_dir()
            .unwrap_or_else(|| std::env::current_dir().expect("Cannot get current directory"))
            .join("openmkview");
        std::fs::create_dir_all(&data_dir).expect("Cannot create data directory");
        data_dir.join("openmkview.db")
    };

    let conn = init_db(&db_path).expect("Database initialization failed");

    log::info!("Database initialization complete: {:?}", db_path);

    let settings_repo = SettingsRepository::new(&conn);
    let settings = settings_repo
        .get_system_settings()
        .expect("Failed to get settings");

    let timeout_minutes = if config.session.timeout_minutes == 0 {
        settings
            .session_timeout_minutes
            .max(default_timeout_minutes())
    } else {
        config.session.timeout_minutes.max(1)
    };

    let passkey_enabled = config.passkeys.enabled && !config.passkeys.sites.is_empty();
    let secure_cookies = if passkey_enabled {
        validate_passkey_config(&config.passkeys).map_err(std::io::Error::other)?
    } else {
        false
    };

    let auth = resolve_auth_config(args.username, args.password, &config)
        .and_then(|auth| {
            auth.map(|cfg| build_auth_state(cfg, timeout_minutes, secure_cookies))
                .transpose()
        })
        .map(|auth| auth.map(Arc::new))
        .map_err(std::io::Error::other)?;

    let bind_addr = format!("{}:{}", args.host, args.port);

    let passkey = if let Some(auth_state) = auth.as_ref() {
        if passkey_enabled {
            Some(Arc::new(
                build_passkey_state(auth_state, &config.passkeys).map_err(std::io::Error::other)?,
            ))
        } else {
            None
        }
    } else {
        None
    };

    let project_repo = ProjectRepository::new(&conn);
    let projects = project_repo.list(false).expect("Failed to list projects");
    let project_ids: Vec<i64> = projects.iter().map(|p| p.id).collect();

    if let Ok(count) =
        TrashService::cleanup_all_expired_trash(settings.trash_expire_days, &project_ids)
    {
        if count > 0 {
            log::info!("Cleaned {} expired trash items", count);
        }
    }

    let app_state = web::Data::new(AppState {
        db: Arc::new(Mutex::new(conn)),
        auth: auth.clone(),
        passkey: passkey.clone(),
    });

    log::info!("Server started at http://{}", bind_addr);
    if auth.is_some() {
        log::info!("Authentication enabled");
        if passkey.is_some() {
            log::info!(
                "Passkey support enabled for {} configured site(s)",
                config.passkeys.sites.len()
            );
        }
    } else {
        log::info!("Authentication disabled");
    }

    if let Some(auth_state) = auth.clone() {
        let mut server = HttpServer::new(move || {
            App::new()
                .wrap(Logger::new(DEBUG_LOG_FORMAT).log_target("openmkview::http"))
                .wrap(AuthMiddleware::new(auth_state.clone()))
                .app_data(app_state.clone())
                .configure(configure_routes)
        })
        .bind(&bind_addr)?;

        if let Some(workers) = args.workers {
            log::info!("Using {} worker threads", workers);
            server = server.workers(workers);
        }

        server.run().await
    } else {
        let mut server = HttpServer::new(move || {
            App::new()
                .wrap(Logger::new(DEBUG_LOG_FORMAT).log_target("openmkview::http"))
                .app_data(app_state.clone())
                .configure(configure_routes)
        })
        .bind(&bind_addr)?;

        if let Some(workers) = args.workers {
            log::info!("Using {} worker threads", workers);
            server = server.workers(workers);
        }

        server.run().await
    }
}

#[cfg(test)]
mod tests {
    use super::validate_passkey_config;
    use openmkview::config::{PasskeySiteFileConfig, PasskeysFileConfig};

    #[test]
    fn validate_passkey_config_rejects_mixed_protocols() {
        let result = validate_passkey_config(&PasskeysFileConfig {
            enabled: true,
            sites: vec![
                site("foo", "http://localhost:4567", "localhost"),
                site("bar", "https://example.com", "example.com"),
            ],
        });

        assert!(result.is_err());
    }

    #[test]
    fn validate_passkey_config_reports_https_cookie_requirement() {
        let result = validate_passkey_config(&PasskeysFileConfig {
            enabled: true,
            sites: vec![site("foo", "https://example.com", "example.com")],
        })
        .unwrap();

        assert!(result);
    }

    #[test]
    fn validate_passkey_config_accepts_uppercase_scheme_from_parser() {
        let result = validate_passkey_config(&PasskeysFileConfig {
            enabled: true,
            sites: vec![site("foo", "HTTPS://example.com", "example.com")],
        })
        .unwrap();

        assert!(result);
    }

    fn site(id: &str, origin: &str, rp_id: &str) -> PasskeySiteFileConfig {
        PasskeySiteFileConfig {
            id: id.to_string(),
            origin: origin.to_string(),
            rp_id: rp_id.to_string(),
            rp_name: None,
        }
    }
}
