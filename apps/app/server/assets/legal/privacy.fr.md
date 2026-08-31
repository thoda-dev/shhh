# Politique de confidentialité

_Dernière mise à jour : {{DATE}}_

Cette instance de [shhh](https://github.com/thoda-dev/shhh) est exploitée par **{{OPERATOR}}**, responsable de traitement pour tout ce qui suit. Pour une question sur cette politique ou pour exercer vos droits, écrivez à **{{CONTACT_EMAIL}}**.

Relisez chaque paragraphe avant publication : les sections ci-dessous décrivent ce que le logiciel fait par défaut, mais les durées, les tiers et les coordonnées sont à vous de les remplir.

## Ce que nous ne voyons pas

Le contenu d'un paste est chiffré dans votre navigateur avant d'être envoyé. La clé voyage dans la partie du lien qui suit le `#`, que les navigateurs ne transmettent jamais au serveur. Cette instance ne conserve qu'un chiffré qu'elle n'a aucun moyen de lire : ni nous, ni quiconque compromettrait le serveur ne peut retrouver un paste à partir de la seule base de données.

Tout ce qui suit concerne donc les données autour d'un paste, pas son contenu.

## Ce que nous traitons

**À la création ou à la lecture d'un paste, connecté ou non**

- Votre adresse IP, pour appliquer les limites de débit et bloquer les abus automatisés.
- La taille et le type du paste, son échéance et son nombre de lectures.
- Un test Cloudflare Turnstile, qui indique qu'une requête vient d'un navigateur et non d'un script. Turnstile voit votre adresse IP et certaines propriétés de votre navigateur. Cloudflare agit comme sous-traitant et peut traiter ces données hors {{JURISDICTION}}.

**Si vous avez un compte**

- Votre nom, votre adresse email et une empreinte de votre mot de passe — jamais le mot de passe.
- Vos sessions, chacune enregistrée avec l'adresse IP et le navigateur qui l'a ouverte, pour que vous puissiez les reconnaître et les révoquer.
- Vos secrets de double authentification et vos codes de secours, si vous l'activez.
- Les pastes dont vous êtes propriétaire, pour qu'ils apparaissent dans votre tableau de bord.

**Si un paste est partagé par email**

- Les adresses des destinataires, conservées avec le paste et supprimées avec lui.

**Si vous recevez un lien par email**

Votre adresse nous a été communiquée par la personne qui vous a envoyé le paste, uniquement pour acheminer son message. Nous ne l'utilisons pour rien d'autre et elle est supprimée avec le paste, au plus tard {{RETENTION_MAX}} après sa création. Vous pouvez demander sa suppression immédiate à l'adresse ci-dessus.

**Quand un administrateur agit**

- Une entrée de journal nommant l'administrateur, l'action et sa cible.

## Pourquoi, et sur quelle base légale

- Fournir le service demandé — créer, stocker et servir les pastes, faire fonctionner votre compte : exécution du contrat.
- Maintenir l'instance disponible et non abusée — limites de débit, blocage d'IP, Turnstile, enregistrement des sessions : notre intérêt légitime à la sécurité du service.
- Envoyer les emails transactionnels — vérification d'adresse, réinitialisation de mot de passe, partage d'un paste : exécution du contrat, et demande de l'expéditeur pour le partage.

Nous ne faisons aucun profilage, aucune publicité, et ne vendons rien.

## Combien de temps

| Donnée | Conservation |
| --- | --- |
| Pastes et destinataires | Jusqu'à l'échéance ou la dernière lecture, au plus {{RETENTION_MAX}} |
| Sessions | {{SESSION_RETENTION}}, ou jusqu'à déconnexion |
| Données de compte | Jusqu'à la suppression du compte |
| Bannissements d'IP automatiques | {{BAN_DURATION}} |
| Bannissements manuels et liste d'autorisation | Jusqu'à retrait par un administrateur |
| Journal d'administration | {{AUDIT_RETENTION}} |

Supprimer votre compte supprime dans la même opération vos pastes, vos sessions et vos secrets de double authentification. Vous le faites vous-même depuis votre page de compte, sans validation de personne.

## Qui d'autre intervient

- **{{HOSTING_PROVIDER}}** — héberge le serveur et la base de données.
- **Cloudflare** — test anti-abus (Turnstile).
- **{{MAIL_PROVIDER}}** — achemine les emails transactionnels.

Personne d'autre ne reçoit vos données, et elles ne sont ni vendues ni partagées à des fins publicitaires.

## Cookies

Cette instance ne dépose aucun cookie publicitaire ni de mesure d'audience, et rien ici ne vous suit d'un site à l'autre. Ce qu'elle dépose est strictement nécessaire à son fonctionnement :

| Cookie | Rôle | Durée |
| --- | --- | --- |
| Cookie de session | Vous garde connecté | Jusqu'à déconnexion ou expiration |
| `shhh_i18n_locale` | Retient la langue choisie | 1 an |
| `shhh_color_mode` | Retient le thème clair ou sombre | 1 an |
| Cloudflare Turnstile | Distingue un navigateur d'un script | Courte durée |

Chacun étant soit nécessaire au service que vous avez demandé, soit nécessaire à sa sécurité, aucun bandeau de consentement n'est affiché. Si cela devait changer — si cette instance ajoutait de la mesure d'audience, par exemple — cette page changerait avec.

## Vos droits

Vous pouvez demander l'accès à vos données, leur rectification, leur effacement, leur portabilité, la limitation de leur traitement, ou vous opposer à un traitement fondé sur notre intérêt légitime. Écrivez à **{{CONTACT_EMAIL}}** : nous répondons sous un mois.

Si vous estimez que nous avons mal traité vos données, vous pouvez saisir {{SUPERVISORY_AUTHORITY}}.

## Modifications

La date en haut de cette page indique sa dernière modification. Les changements substantiels sont annoncés {{CHANGE_NOTICE}}.
