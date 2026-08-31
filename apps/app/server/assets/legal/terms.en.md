# Terms of use

_Last updated: {{DATE}}_

These terms govern your use of {{INSTANCE_URL}}, an instance of [shhh](https://github.com/thoda-dev/shhh) operated by **{{OPERATOR}}**. Using the service means accepting them; if you do not accept them, do not use it.

## What the service does

You paste text or a file, your browser encrypts it, and you get back a link. The decryption key travels in the part of that link which follows `#`, and browsers never send it to a server. The instance therefore stores ciphertext it has no way to read.

## The link is the secret

This is the whole design, and the whole risk that comes with it:

- **Anyone holding the link can read the paste**, until it expires or its read count runs out. Treat the link exactly as you would treat the secret inside it.
- **A lost link cannot be recovered** — not by you, not by us. Without the key it carries, what is stored is unreadable, and no request to the operator changes that.
- **Where you send the link matters.** Pasted into a chat, a ticket or an email, it survives as long as that conversation does.

## This is not storage

A paste is deleted when it expires or when its last read is spent, at the latest {{RETENTION_MAX}} after it was created. It may also disappear sooner — a purge, a failure, a restore from a backup, or a decision by the operator. Keep your own copy of anything you care about: the service is not a backup, an archive, or a file host.

## What you may not do

You are responsible for what you put in and for who you send it to. You may not use this instance to:

- store or share anything unlawful where you or your recipient are;
- distribute malware, phishing pages, or credentials obtained without consent;
- share somebody else's personal data without a reason to;
- send unsolicited mail through the email-sharing feature, which exists for people who are expecting your message;
- work around the rate limits, probe the instance, or point automated clients at it.

Because the contents are encrypted, the operator cannot see what you store and does not inspect it. Enforcement is reactive: report a link at {{CONTACT_EMAIL}} and it can be removed.

## Accounts

Where this instance allows registration:

- Keep your password to yourself, and turn on two-factor authentication if it is offered.
- One account per person, and you are responsible for what happens under yours.
- You can delete your account yourself at any time from your account page. It takes your pastes and your sessions with it.
- The operator may suspend or delete an account, or block an address, when these terms are broken.

You must be at least {{MINIMUM_AGE}} years old to hold an account.

## Availability

The service is provided as it is, with no promise that it works, that it keeps working, or that it is reachable when you need it. There is no service level and no support commitment, and the operator may change, restrict, or shut down the instance at any time.

## Liability

So far as the law allows, the operator is not liable for lost data, a lost link, a paste that expired sooner than you expected, or any loss arising from your use of the service. Nothing here removes a liability that cannot be excluded by law.

The software is published under the MIT licence and comes with no warranty. Its authors are not party to these terms: they neither operate this instance nor have access to it.

## Personal data

See the [privacy policy](/legal/privacy).

## Changes

The date at the top of this page says when these terms last changed. Substantial changes are announced {{CHANGE_NOTICE}}.

## Law and courts

These terms are governed by {{GOVERNING_LAW}}. Any dispute goes before {{COURTS}}, without prejudice to any rule entitling you to bring it elsewhere.

## Contact

{{CONTACT_EMAIL}}
