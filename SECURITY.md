# Security policy

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainer for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove tokens, client secrets, e-mails and
  addresses first).

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## What the integration does with your Huawei account

- It never sees your HUAWEI ID password: you sign in on Huawei's own page
  (OAuth 2.0 authorization-code flow), protected by a random anti-CSRF state
  that expires after 15 minutes.
- The **Client secret** of your Huawei app is a `secret` field, never shown
  back in the interface. The access and refresh tokens are stored by Gladys as
  integration configuration keys outside the form: never displayed, never sent
  to the browser. The **Sign out** action erases them.
- Your Huawei OpenID is never stored: the Gladys device is keyed by a
  truncated SHA-256 hash of it.
- The integration only **reads** your data, with the read scopes you chose. It
  only talks to Huawei's official hosts (`oauth-login.cloud.huawei.com` and the
  `health-api.cloud.huawei.*` sites), over HTTPS, and only follows a site
  redirection to another `health-api.cloud.huawei.*` host.
- Health data stays between Huawei and your Gladys. Nothing is sent anywhere
  else, and the logs never contain tokens, the client secret nor health
  values.

## Scope

In scope: the code of this repository and the Docker image it publishes.

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
and Huawei's services, apps and devices.
