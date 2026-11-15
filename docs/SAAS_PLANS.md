# SaaS Plan Catalog

The first SaaS release uses manually administered plans. No prices or payment provider are configured in code.

| Plan | Menu items | Categories | Orders / month | AR models | Max upload |
|---|---:|---:|---:|---:|---:|
| Starter | 30 | 6 | 100 | 3 | 15 MB |
| Growth | 150 | 25 | 1,500 | 30 | 15 MB |
| Scale | 1,000 | 100 | 15,000 | 300 | 15 MB |

Every plan currently includes digital menus, QR codes, ordering, and the AR viewer. Growth and Scale also include the `advanced_ar` and `menu_analytics` feature flags; Scale includes `priority_support`.

A new tenant receives a 14-day Starter trial. A super-admin can activate, suspend, cancel, or change a plan manually. Expired trials and non-active statuses cannot create new menu content, upload assets, or place new orders. Public menus remain readable.

Plan limits are enforced by backend admission checks, not only by frontend controls. These checks are count-before-write and are not atomic under concurrent writes; strict usage billing requires atomic quota reservations and a reconciliation job.

Payment processing, invoice generation, recurring billing, proration, taxes, and automated subscription renewal are out of scope until a provider is selected.
