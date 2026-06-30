# Sample Emails for Testing the AI Detection

Use these to demonstrate that the AI correctly detects phishing, spam and safe
emails. Send them from one registered user to another inside the app, then check
the recipient's folders.

**How to test in the app:**
1. Register two users (e.g. `alice@uol.com` and `bob@uol.com`).
2. Log in as the sender and compose an email to the other user.
3. Paste one of the subjects/bodies below and send it.
4. Log in as the recipient and check:
   - **Phishing / Spam** examples → land in the **Spam** folder with a threat badge.
   - **Safe** examples → land in the **Inbox**.
5. Open the email to see the AI verdict ("**AI model detected…**") and confidence.

> You can also test all of these instantly from the command line, without the UI:
> open the `backend` folder and run **`npm run test:ai`**.

---

## 🔴 PHISHING (should go to Spam, flagged as phishing)

**1. Account suspension scam**
- **Subject:** `Your account is suspended`
- **Body:**
  > Dear customer, we detected unusual activity on your account. Verify your
  > password now at http://secure-paypa1.com or your account will be closed
  > permanently.

**2. Bank credential theft**
- **Subject:** `Reset your bank password`
- **Body:**
  > We noticed a login from a new device. Confirm your identity and enter your
  > card number to keep your account active.

**3. Delivery/parcel scam**
- **Subject:** `Your package could not be delivered`
- **Body:**
  > Your parcel is on hold. Pay the £1.99 customs fee within 24 hours by entering
  > your card details here or the package will be returned.

---

## 🟠 SPAM (junk / promotional — should go to Spam)

**4. Prize / lottery spam**
- **Subject:** `Congratulations you WON`
- **Body:**
  > You have won a $1000 gift card. Claim your free prize now! Click here,
  > limited time offer!

**5. Fake pharmacy spam**
- **Subject:** `Cheap meds online`
- **Body:**
  > Buy discount pharmacy pills online now, huge savings, order today no
  > prescription needed.

---

## 🟢 SAFE (legitimate — should go to Inbox)

**6. Work email**
- **Subject:** `Project meeting tomorrow`
- **Body:**
  > Hi team, can we move the project review meeting to 3pm tomorrow? I attached
  > the invoice for the client. Thanks, Sarah

**7. Friendly email**
- **Subject:** `Lunch?`
- **Body:**
  > Hey! Want to grab lunch this Friday? It has been ages. Let me know!

**8. Business email**
- **Subject:** `Quarterly report`
- **Body:**
  > Please find attached the quarterly report. Let me know if you have any
  > questions.

---

## Expected results summary

| # | Type | Expected folder | Expected label |
|---|------|-----------------|----------------|
| 1 | Phishing | Spam | phishing |
| 2 | Phishing | Spam | phishing |
| 3 | Phishing | Spam | phishing |
| 4 | Spam | Spam | phishing/spam |
| 5 | Spam | Spam | phishing/spam |
| 6 | Safe | Inbox | important/safe |
| 7 | Safe | Inbox | safe |
| 8 | Safe | Inbox | safe |

> Note: because safety comes first, strongly worded junk (e.g. #4, #5) may be
> labelled as **phishing** rather than **spam** — both go to the Spam folder, so
> the user is protected either way.
