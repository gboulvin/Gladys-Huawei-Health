# Huawei Santé

Votre compte Huawei Santé (Huawei Health) dans Gladys : les valeurs santé de
vos montres, bracelets et balances Huawei (pas, fréquence cardiaque, SpO2,
stress, sommeil, poids, température corporelle), des déclencheurs et des
actions de scène, et trois widgets de tableau de bord.

L'intégration lit le **cloud Huawei Santé** via l'API officielle de Huawei,
**Health Service Kit**. Elle n'écrit jamais dans votre compte. Votre montre
continue de se synchroniser comme d'habitude via l'application Huawei Santé de
votre téléphone ; Gladys lit ensuite le cloud.

> **Avant de commencer.** Huawei n'ouvre Health Service Kit qu'aux
> applications qu'il a examinées. Il vous faut votre propre compte développeur
> Huawei (gratuit) et une application validée : comptez environ **10 jours
> ouvrés** d'examen par Huawei. Les étapes sont ci-dessous.

## 1. Créer votre application Huawei

1. Créez un compte développeur sur
   [HUAWEI Developers](https://developer.huawei.com/consumer/fr/) et terminez
   la vérification d'identité (particulier ou entreprise).
2. Dans la **Console**, ouvrez **HUAWEI ID** → **Apply for HUAWEI ID**.
   Choisissez le type de produit **Server app** (ou **Web app**), créez le
   produit et, dans **Callback URL**, saisissez l'adresse de redirection
   affichée par Gladys sous le bouton **Connecter** de l'intégration (par
   défaut `https://my.gladysassistant.com/redirect/oauth`).
3. Notez l'**App ID** (Client ID) et l'**App secret** (Client secret).
4. Dans la Console, ouvrez **Health Service Kit** → **Apply for Health
   Service Kit**, choisissez le même produit et cochez les permissions de
   **lecture** des données voulues, au minimum :
   - Activité : **Steps**, **Calories**, **Distance** ;
   - Santé : **Heart rate**, **SpO2**, **Stress**, **Body temperature**,
     **Body fat** (poids), **Sleep**.
     Remplissez le formulaire de demande fourni par Huawei (décrivez un usage
     domotique personnel) et envoyez.
5. Attendez l'e-mail de Huawei (environ 10 jours ouvrés). Les permissions sont
   utilisables environ 24 heures après la validation.

À savoir :

- La validation « test » autorise jusqu'à 100 utilisateurs : largement assez
  pour un foyer.
- Huawei indique que les développeurs particuliers n'ont accès qu'au niveau
  d'ouverture « basique » et peuvent devoir publier une application mobile ;
  si votre demande est refusée pour cette raison, un compte développeur
  entreprise est la solution documentée.
- Huawei ne partage que les données produites **après** la liaison de votre
  compte (pas d'historique antérieur à l'autorisation).

## 2. Configurer l'intégration

1. Ouvrez l'onglet **Configuration** de l'intégration.
2. Saisissez le **Client ID** et le **Client secret**.
3. Dans **Données à lire**, ne gardez que ce que votre application a obtenu :
   Huawei refuse la connexion si une permission n'a pas été accordée.
4. Réglages facultatifs : intervalle de rafraîchissement (15 minutes par
   défaut, 5 minutes minimum), fuseau horaire (pour savoir quel jour est
   « aujourd'hui »), objectif de pas quotidien et seuils d'alerte (fréquence
   cardiaque haute/basse, SpO2 basse).
5. **Enregistrez**, puis cliquez sur **Connecter** et connectez-vous avec le
   **HUAWEI ID** utilisé par votre application Huawei Santé.
6. Sur votre téléphone, dans l'application **Huawei Santé**, ouvrez **Moi →
   Gestion de la confidentialité** et autorisez le partage des données avec
   Health Kit (l'action **Tester la connexion** vous le signale s'il manque).

## 3. Appareils

Ouvrez l'onglet **Découverte** et ajoutez **Huawei Health - <votre nom>**. Il
porte une fonctionnalité en lecture seule par valeur :

| Valeur                                             | Groupe              |
| -------------------------------------------------- | ------------------- |
| Pas, calories actives, distance (du jour)          | Activité            |
| Fréquence cardiaque, FC au repos, VFC              | Fréquence cardiaque |
| Oxygène sanguin (SpO2)                             | Oxygène sanguin     |
| Score de stress                                    | Stress              |
| Température corporelle et cutanée                  | Température         |
| Poids, indice de masse corporelle, masse grasse    | Poids               |
| Score de sommeil, total, profond, léger, paradoxal | Sommeil             |

Huawei fusionne tous les appareils du compte (montre, bracelet, balance,
téléphone) : l'historique survit à un changement de montre. Une valeur que vos
appareils ne mesurent pas reste vide. L'action **Tester la connexion** et le
widget de synthèse listent les appareils connus de Huawei.

## Actions

- **Tester la connexion** : vérifie l'autorisation Huawei et le partage dans
  l'appli Santé, et liste vos appareils.
- **Synchroniser maintenant** : lit immédiatement le cloud Huawei.
- **Se déconnecter** : supprime les jetons Huawei de Gladys. Pour révoquer
  complètement l'accès, retirez aussi l'application de votre HUAWEI ID
  (paramètres du compte → confidentialité).

## Déclencheurs de scène

| Déclencheur                       | Quand                                                        | Variables                                      |
| --------------------------------- | ------------------------------------------------------------ | ---------------------------------------------- |
| Nuit de sommeil enregistrée       | une nouvelle nuit arrive dans le cloud                       | score, durée, sommeil profond, heure de réveil |
| Objectif de pas quotidien atteint | les pas du jour dépassent l'objectif (une fois par jour)     | pas, objectif                                  |
| Fréquence cardiaque anormale      | une nouvelle mesure franchit un seuil (filtre : haute/basse) | fréquence cardiaque, sens                      |
| Oxygène sanguin bas               | une nouvelle mesure de SpO2 passe sous le seuil              | SpO2                                           |
| Nouvelle pesée                    | un nouveau poids arrive dans Huawei Santé                    | poids, IMC, masse grasse                       |

La première lecture après un redémarrage sert de référence : elle ne
déclenche jamais rien.

## Actions de scène

- **Synchroniser Huawei Santé** : sortie `synced`.
- **Obtenir le résumé santé** (option : synchroniser d'abord) : pas, calories
  actives, distance, fréquence cardiaque, FC au repos, SpO2, stress, poids,
  score et durée de sommeil, heure de la dernière synchro. Exemple de
  message : « Tu as dormi {{sleep_minutes}} minutes, score {{sleep_score}} ».

## Widgets de tableau de bord

- **Huawei Santé** : pas, fréquence cardiaque, SpO2, stress, score de sommeil
  et poids, avec le compte, la dernière synchro et vos appareils, et un bouton
  Rafraîchir.
- **Activité Huawei** : jauge de l'objectif de pas, calories actives, distance
  et graphique des 7 derniers jours.
- **Sommeil Huawei** : score et phases de la dernière nuit, heures
  d'endormissement et de réveil, et courbe de fréquence cardiaque des
  dernières 24 h (l'appareil doit être créé dans Gladys).

## Dépannage

- **« Cliquez sur Connecter »** : le compte n'est pas lié, ou le Client ID a
  changé.
- **Certaines données n'ont pas pu être lues** : la permission n'est pas
  accordée à votre application, ou n'était pas cochée lors du clic sur
  Connecter. Corrigez dans la console Huawei, puis cliquez à nouveau sur
  **Connecter**.
- **Aucune donnée mais « connecté »** : autorisez le partage dans l'appli
  Huawei Santé (Moi → Gestion de la confidentialité) et attendez que la montre
  se synchronise avec le téléphone.
- **« Autorisation expirée »** : le jeton Huawei dure environ six mois et
  expire si vous changez le mot de passe de votre HUAWEI ID : cliquez à
  nouveau sur **Connecter**.
- Les comptes enregistrés hors d'Europe sont servis par un autre site Huawei :
  l'intégration le trouve toute seule.
