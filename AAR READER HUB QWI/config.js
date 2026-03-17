(function mergeQwiConfig(global) {
  const shared = global.AAR_READER_CONFIG || {};
  const sharedDrive = shared.googleDrive || {};
  const sharedStatic = shared.staticRepo || {};

  const local = {
    autoSyncOnStartup: false,
    googleDrive: {
      oauthClientId: "100011978859-sc6aj28as11aqeqmrubrb4rccocvqe9r.apps.googleusercontent.com",
      apiKey: "AIzaSyAIOITquStWBYg6eLA0hPR7etSct16u2ts",
      folderId: "18RTzOZzYWEIFWS5NXyYA_Ts3Xyf2X5kX",
      indexFileId: ""
    },
    staticRepo: {
      enabled: false,
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
