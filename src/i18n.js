// -----------------------------------------------------------------------------
// User-facing messages (action results, connection statuses, widget texts), in
// the four languages of the Gladys interface. Gladys picks the user's language
// and falls back to `en`.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

export const MESSAGES = {
  signedOut: {
    en: 'Signed out: the Huawei tokens were deleted. Click Connect to link an account again.',
    fr: 'Déconnecté : les jetons Huawei ont été supprimés. Cliquez sur Connecter pour lier à nouveau un compte.',
    de: 'Abgemeldet: Die Huawei-Token wurden gelöscht. Klicken Sie auf Verbinden, um erneut ein Konto zu verknüpfen.',
    es: 'Sesión cerrada: se han eliminado los tokens de Huawei. Haga clic en Conectar para vincular de nuevo una cuenta.',
  },
  notConfigured: {
    en: 'Enter the Client ID and Client secret of your Huawei app, save, then click Connect.',
    fr: 'Saisissez le Client ID et le Client secret de votre application Huawei, enregistrez, puis cliquez sur Connecter.',
    de: 'Geben Sie die Client-ID und das Client-Secret Ihrer Huawei-App ein, speichern Sie und klicken Sie dann auf Verbinden.',
    es: 'Introduzca el Client ID y el Client secret de su aplicación Huawei, guarde y haga clic en Conectar.',
  },
  notLinked: {
    en: 'Click Connect to link your Huawei account.',
    fr: 'Cliquez sur Connecter pour lier votre compte Huawei.',
    de: 'Klicken Sie auf Verbinden, um Ihr Huawei-Konto zu verknüpfen.',
    es: 'Haga clic en Conectar para vincular su cuenta Huawei.',
  },
  reconnect: {
    en: 'The Huawei authorization expired or was revoked: click Connect again.',
    fr: "L'autorisation Huawei a expiré ou a été révoquée : cliquez à nouveau sur Connecter.",
    de: 'Die Huawei-Autorisierung ist abgelaufen oder wurde widerrufen: Klicken Sie erneut auf Verbinden.',
    es: 'La autorización de Huawei ha caducado o ha sido revocada: vuelva a hacer clic en Conectar.',
  },
  clientChanged: {
    en: 'The Client ID changed: click Connect to authorize the new Huawei app.',
    fr: 'Le Client ID a changé : cliquez sur Connecter pour autoriser la nouvelle application Huawei.',
    de: 'Die Client-ID hat sich geändert: Klicken Sie auf Verbinden, um die neue Huawei-App zu autorisieren.',
    es: 'El Client ID ha cambiado: haga clic en Conectar para autorizar la nueva aplicación Huawei.',
  },
  cloudError: {
    en: 'Huawei Health cloud unreachable, retrying at the next refresh.',
    fr: 'Cloud Huawei Santé injoignable, nouvel essai au prochain rafraîchissement.',
    de: 'Huawei Health Cloud nicht erreichbar, neuer Versuch bei der nächsten Aktualisierung.',
    es: 'Nube de Huawei Salud inaccesible, se reintentará en la próxima actualización.',
  },
  privacyNotGranted: {
    en: 'Linked, but the Huawei Health app does not share its data yet: in the Health app, open Me > Privacy management and allow data sharing with Health Kit.',
    fr: "Compte lié, mais l'application Huawei Santé ne partage pas encore ses données : dans l'appli Santé, ouvrez Moi > Gestion de la confidentialité et autorisez le partage avec Health Kit.",
    de: 'Verknüpft, aber die Huawei Health-App teilt ihre Daten noch nicht: Öffnen Sie in der Health-App Ich > Datenschutzverwaltung und erlauben Sie die Freigabe für Health Kit.',
    es: 'Vinculada, pero la app Huawei Salud aún no comparte sus datos: en la app Salud, abra Yo > Gestión de privacidad y permita compartir datos con Health Kit.',
  },
  syncDone: {
    en: 'Huawei Health data refreshed.',
    fr: 'Données Huawei Santé rafraîchies.',
    de: 'Huawei Health-Daten aktualisiert.',
    es: 'Datos de Huawei Salud actualizados.',
  },
  partialSync: {
    en: 'Refreshed, but some data could not be read: {groups}. Check the scopes granted to your Huawei app.',
    fr: "Rafraîchi, mais certaines données n'ont pas pu être lues : {groups}. Vérifiez les permissions accordées à votre application Huawei.",
    de: 'Aktualisiert, aber einige Daten konnten nicht gelesen werden: {groups}. Prüfen Sie die Ihrer Huawei-App gewährten Berechtigungen.',
    es: 'Actualizado, pero algunos datos no se pudieron leer: {groups}. Compruebe los permisos concedidos a su aplicación Huawei.',
  },
  connectionOk: {
    en: 'Connected to Huawei Health. Devices seen: {devices}.',
    fr: 'Connecté à Huawei Santé. Appareils vus : {devices}.',
    de: 'Mit Huawei Health verbunden. Erkannte Geräte: {devices}.',
    es: 'Conectado a Huawei Salud. Dispositivos detectados: {devices}.',
  },
  noDevice: {
    en: 'none yet',
    fr: 'aucun pour le moment',
    de: 'noch keine',
    es: 'ninguno por ahora',
  },
  invalidState: {
    en: 'Authorization refused: the request expired or did not come from this Gladys. Click Connect again.',
    fr: 'Autorisation refusée : la demande a expiré ou ne vient pas de ce Gladys. Cliquez à nouveau sur Connecter.',
    de: 'Autorisierung abgelehnt: Die Anfrage ist abgelaufen oder stammt nicht von diesem Gladys. Klicken Sie erneut auf Verbinden.',
    es: 'Autorización rechazada: la solicitud caducó o no procede de este Gladys. Vuelva a hacer clic en Conectar.',
  },
};

/** A message with its `{placeholders}` replaced, in every language. */
export function message(key, params = {}) {
  return Object.fromEntries(
    Object.entries(MESSAGES[key]).map(([lang, text]) => [
      lang,
      text.replace(/\{(\w+)\}/g, (match, name) => {
        const value = params[name];
        if (value && typeof value === 'object') {
          return value[lang] ?? value.en;
        }
        return value ?? match;
      }),
    ]),
  );
}
