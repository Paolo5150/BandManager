This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Scheduled push notifications

Set a strong `CRON_SECRET` in the application environment. A trusted scheduler can send a push notification with `POST /api/notifications/send`, using `Authorization: Bearer <CRON_SECRET>` and a JSON body like:

```json
{
  "bandId": "<band UUID>",
  "recipientMembershipIds": ["<confirmed membership UUID>"],
  "notification": {
    "title": "Upcoming rehearsal",
    "body": "Rehearsal starts tomorrow at 7 PM.",
    "url": "/dashboard/schedule"
  }
}
```

The endpoint requires `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `VAPID_PUBLIC_KEY`, and `VAPID_PRIVATE_KEY` to be configured on the server. Recipients must be confirmed members of the specified band. Requests can target at most 500 memberships; omit `url` to open `/dashboard` when a notification is clicked.
