(function mergeQwiConfig(global) {
  const shared = global.AAR_READER_CONFIG || {};
  const sharedDrive = shared.googleDrive || {};
  const sharedStatic = shared.staticRepo || {};

  const local = {
    autoSyncOnStartup: false,
    googleDrive: {
      oauthClientId: "",
      apiKey: "",
      folderId: "",
      indexFileId: ""
    },
    staticRepo: {
      enabled: true,
      indexUrl: "./AAR Reader Data/index.json"
    }
  };

  global.AAR_READER_CONFIG = {
    autoSyncOnStartup: typeof shared.autoSyncOnStartup === "boolean" ? shared.autoSyncOnStartup : local.autoSyncOnStartup,
    googleDrive: {
      oauthClientId: local.googleDrive.oauthClientId || sharedDrive.oauthClientId || "",
      apiKey: local.googleDrive.apiKey || sharedDrive.apiKey || "",
      folderId: local.googleDrive.folderId || sharedDrive.folderId || "",
      indexFileId: local.googleDrive.indexFileId || sharedDrive.indexFileId || ""
    },
    staticRepo: {
      enabled: typeof local.staticRepo.enabled === "boolean" ? local.staticRepo.enabled : (sharedStatic.enabled !== false),
      indexUrl: local.staticRepo.indexUrl || sharedStatic.indexUrl || "./AAR Reader Data/index.json"
    }
  };
})(window);
