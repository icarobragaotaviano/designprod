/* Camada minima sem dependencias para extensoes Adobe CEP (CSXS 8+). */
(function (root) {
  'use strict';

  var SystemPath = {
    USER_DATA: 'userData',
    COMMON_FILES: 'commonFiles',
    MY_DOCUMENTS: 'myDocuments',
    APPLICATION: 'application',
    EXTENSION: 'extension',
    HOST_APPLICATION: 'hostApplication'
  };

  function CSInterface() {
    this.hostEnvironment = null;
  }

  CSInterface.prototype.getHostEnvironment = function () {
    if (!root.__adobe_cep__) return { appName: 'ILST', appVersion: '0.0' };
    try {
      this.hostEnvironment = JSON.parse(root.__adobe_cep__.getHostEnvironment());
    } catch (e) {
      this.hostEnvironment = { appName: 'ILST', appVersion: '0.0' };
    }
    return this.hostEnvironment;
  };

  CSInterface.prototype.getSystemPath = function (pathType) {
    if (!root.__adobe_cep__) return '';
    return decodeURI(root.__adobe_cep__.getSystemPath(pathType));
  };

  CSInterface.prototype.evalScript = function (script, callback) {
    if (!root.__adobe_cep__) {
      if (callback) callback('ERRO:Ambiente CEP indisponivel');
      return;
    }
    root.__adobe_cep__.evalScript(script, callback || function () {});
  };

  root.SystemPath = SystemPath;
  root.CSInterface = CSInterface;
}(window));
