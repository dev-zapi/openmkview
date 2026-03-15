use crate::db::SettingsRepository;
use crate::errors::AppResult;
use crate::models::SystemSettings;

pub struct SettingsService<'a> {
    settings_repo: SettingsRepository<'a>,
}

impl<'a> SettingsService<'a> {
    pub fn new(settings_repo: SettingsRepository<'a>) -> Self {
        Self { settings_repo }
    }

    pub fn get_settings(&self) -> AppResult<SystemSettings> {
        self.settings_repo.get_system_settings()
    }

    pub fn save_settings(&self, settings: &SystemSettings) -> AppResult<()> {
        self.settings_repo.save_system_settings(settings)
    }
}
