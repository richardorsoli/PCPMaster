/**
 * PCPMaster v2.3 — Web App de autenticação nativa.
 * Planilha vinculada ao projeto. Aba "Usuarios": Nome | Email | SenhaHash | Token
 * Implantar como aplicativo da web (executar como eu, acesso: qualquer pessoa).
 * Colar a URL em CONFIG.APPS_SCRIPT_URL (js/config.js).
 */
var USUARIOS_SHEET = 'Usuarios';

function doPost(e) {
  var body = {};
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ success: false, message: 'JSON inválido.' });
  }
  var action = String(body.action || '');
  if (action === 'loginNativo') return json_(loginNativo_(body));
  if (action === 'cadastrarUsuario') return json_(cadastrarUsuario_(body));
  return json_({ success: false, message: 'Ação desconhecida.' });
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function usuariosSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(USUARIOS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(USUARIOS_SHEET);
    sheet.appendRow(['Nome', 'Email', 'SenhaHash', 'Token']);
  }
  return sheet;
}

function emailValido_(email) {
  var value = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return '';
  return value;
}

function hashSenha_(password) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(password), Utilities.Charset.UTF_8);
  return bytes.map(function (b) {
    var v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

function acharLinha_(sheet, email) {
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][1] || '').trim().toLowerCase() === email) return i + 1;
  }
  return 0;
}

function loginNativo_(body) {
  var email = emailValido_(body.email);
  var password = String(body.password || '');
  if (!email) return { success: false, message: 'Informe um e-mail válido (usuario@dominio).' };
  if (password.length < 6) return { success: false, message: 'Senha inválida.' };
  var sheet = usuariosSheet_();
  var row = acharLinha_(sheet, email);
  if (!row) return { success: false, message: 'E-mail ou senha incorretos.' };
  var stored = String(sheet.getRange(row, 3).getValue() || '');
  if (stored !== hashSenha_(password)) return { success: false, message: 'E-mail ou senha incorretos.' };
  var token = Utilities.getUuid();
  sheet.getRange(row, 4).setValue(token);
  return {
    success: true,
    message: 'Login realizado.',
    usuario: {
      name: String(sheet.getRange(row, 1).getValue() || ''),
      email: email,
      token: token
    }
  };
}

function cadastrarUsuario_(body) {
  var email = emailValido_(body.email);
  var name = String(body.name || '').trim();
  var password = String(body.password || '');
  if (name.length < 2) return { success: false, message: 'Informe o nome.' };
  if (!email) return { success: false, message: 'Informe um e-mail válido (usuario@dominio).' };
  if (password.length < 6) return { success: false, message: 'A senha precisa ter pelo menos 6 caracteres.' };
  var sheet = usuariosSheet_();
  if (acharLinha_(sheet, email)) return { success: false, message: 'Este e-mail já está cadastrado.' };
  var token = Utilities.getUuid();
  sheet.appendRow([name, email, hashSenha_(password), token]);
  return {
    success: true,
    message: 'Usuário cadastrado.',
    usuario: { name: name, email: email, token: token }
  };
}
