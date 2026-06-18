# FD Vault Prototype Exploration & Design Report

This document details the complete flow, pages, interactive elements, and the exact design system of the FD Vault Prototype. It is intended to serve as a comprehensive blueprint for replicating the app in Kotlin (Jetpack Compose).

## Part 1: Design System & Tokens (Jetpack Compose Reference)

The prototype uses a modern Light Lavender / Mint / Black theme with a warm off-white base.

### 1. Color Palette (Theme)
- **Backgrounds**:
  - Base Background (`bg-base`): `#F5F0EC`
  - Elevated/Card Background (`bg-elevated`): `#FFFFFF`
  - Tertiary Background (`bg-tertiary`): `#EDE8E3`
- **Text & Content**:
  - Primary Text (`text-1`): `#1A1A2E`
  - Secondary Text (`text-2`): `#2D2D44`
  - Tertiary Text (`text-3`): `rgba(26, 26, 46, 0.6)`
  - Quaternary Text (`text-4`): `rgba(26, 26, 46, 0.4)`
  - Separators / Borders (`separator`): `rgba(26, 26, 46, 0.08)`
- **Brand & Accent Colors**:
  - **Fixed Deposit (Mint)**: `#5CB88A` (Dim: `#4CA87A`, Soft Background: `rgba(92, 184, 138, 0.12)`)
  - **Recurring Deposit (Lavender)**: `#9B8EC4` (Dim: `#8A7DB5`, Soft Background: `rgba(155, 142, 196, 0.12)`)
  - **Gold / Warning**: `#D4A843` (Soft: `rgba(212, 168, 67, 0.10)`)
  - **Error**: `#E05555`
  - **Secondary Accents**: Soft Mint (`#B8E8D0`) and Soft Lavender (`#DDD2F0`).

### 2. Typography
- **Font Family**: Primary font is **Inter** (with fallbacks to `-apple-system`, `SF Pro Display`).
- **Styles**:
  - **Headings / Large Values**: Heavy weights (Bold `700`, ExtraBold `800`), tight letter spacing (`-0.02em` to `-0.04em`).
  - **Financial Numbers**: Tabular nums enabled for all currency and rate values.
  - **Body text**: Regular/Medium weights (`400`, `600`), slightly looser tracking.

### 3. Shapes & Corner Radii
- **Extra Small (`r-xs`)**: `8px` (Inputs, Dropdowns)
- **Small (`r-sm`)**: `12px` (Small Cards, Icons)
- **Medium (`r-md`)**: `14px` (List Items)
- **Card (`r-card`)**: `16px` (Standard Cards)
- **Large (`r-lg`)**: `18px`
- **Extra Large (`r-xl`)**: `22px`
- **Bento Grid Cards**: `24px`
- **Pill / Circular (`r-pill`)**: `100px` (or `CircleShape` for Compose buttons, chips).

### 4. Elevations & Shadows
The prototype relies on subtle, soft shadows rather than hard drops:
- **Small Shadow**: `0 1px 3px rgba(26, 26, 46, 0.04), 0 1px 2px rgba(26, 26, 46, 0.03)`
- **Medium Shadow**: `0 4px 12px rgba(26, 26, 46, 0.06), 0 1px 3px rgba(26, 26, 46, 0.04)`
- *Compose Note:* Use very low `elevation` combined with subtle border strokes (`1px` width of `separator` color) to achieve this look.

### 5. Key UI Component Styles
- **Dashboard Bento Grid**: `24px` corner radius, elevated white background, with `1px` separator border.
- **Section Cards**: `16px` corner radius, elevated white background.
- **Primary CTA Buttons**: Black background (`#1A1A2E`), white text, medium corner radius, `18px 32px` padding. Active state scales down to `0.97f`.
- **Filter Chips**: Pill-shaped. Active state uses soft brand color background (e.g., Mint soft) with primary brand color text. Inactive state is transparent with tertiary text.
- **Bottom Navigation**: Glassmorphic effect with `rgba(245, 240, 236, 0.82)` background and subtle top border (`rgba(0,0,0,0.06)`).
- **Floating Action Button (FAB)**: Deep black background (`#1A1A2E`), large shadow, elevated prominently.
- **Top Headers**: Pure black (`#000000`) background with white text and translucent (`rgba(255,255,255,0.1)`) icon buttons on sub-pages.

---

## Part 2: Page-by-Page App Exploration

### 1. Onboarding Page (Initial View)
- **URL Path**: `/` (Initial State)
- **Description**: The landing screen before the user has authenticated, styled with a soft lavender background and animated holographic elements.
- **Buttons & Interactions**:
  - `Continue with Google`: Simulates user login and navigates to the Dashboard page. This is the primary action on this screen.
  - **Bottom Navigation Bar**: Visually present, but clicking items (`Home`, `Deposits`, `Analytics`, `Settings`, or the `add` FAB) typically behaves as disabled or prompts for login when unauthenticated.

### 2. Home / Dashboard Page (Logged In)
- **URL Path**: `/` (Dashboard View)
- **Description**: The primary view after logging in, showcasing a bento-grid style summary of the portfolio and a list of upcoming maturities.
- **Buttons & Interactions**:
  - `Notifications` (Bell Icon): Shows a notification count. Clicking this would typically open a notifications pane or modal.
  - **Maturity Filter Chips** (`30d`, `90d`, `180d`): Allows the user to filter the upcoming maturities list based on the time remaining until maturity.
  - `Maturity Item Cards`: Clickable cards representing individual deposits nearing maturity. Clicking a card navigates the user to the **FD Details** screen for that specific deposit.
  - **Bottom Navigation Bar**: Fully functional.
    - `Home`: Stays on or returns to the Dashboard.
    - `Deposits`: Navigates to the Deposits list page.
    - `+` (FAB): Opens the **Add New Deposit** bottom sheet.
    - `Analytics`: Navigates to the Analytics page.
    - `Settings`: Navigates to the Settings page.

### 3. FD Details Page
- **URL Path**: `/` (Detail View)
- **Description**: Displays detailed statistics and information about a selected deposit (e.g., principal, interest rate, maturity amount, yield, payout type, compounding frequency).
- **Buttons & Interactions**:
  - `Back` (Arrow Icon): Navigates back to the previous screen (e.g., the Dashboard or Deposits list).
  - `Edit` (Pencil Icon): Intended to open an edit mode or form for modifying the current deposit's details.
  - `Delete` (Trash Icon): Intended to prompt a deletion confirmation for the current deposit.

### 4. Deposits Page
- **URL Path**: `/` (Deposits List View)
- **Description**: A comprehensive list of all the user's deposits, with robust filtering and sorting options.
- **Buttons & Interactions**:
  - `Search` (Magnifying Glass Icon): Intended to allow text-based searching of deposits.
  - `Add` (Header Icon) & `+` (Bottom FAB): Both buttons open the **Add New Deposit** bottom sheet.
  - **Filter Tabs** (`All`, `FD`, `RD`, `Matured`, `Closed`): Dynamically filters the list of displayed deposit cards based on their status or type.
  - **Dropdowns** (`Sort By`, `Bank`, `Member`): Interactive selectors for sorting the list (e.g., by maturity date, interest rate) and filtering by specific institutions or family members.
  - **Deposit Cards**: Individual items representing deposits. Clicking any card navigates to its respective **FD Details** page.

### 5. Add New Deposit Dialog / Forms
- **Description**: The flow for creating new Fixed Deposits (FD) or Recurring Deposits (RD).

#### Add New Deposit Bottom Sheet
- **Buttons & Interactions**:
  - `Fixed Deposit`: Option that navigates to the **Add Fixed Deposit** form.
  - `Recurring Deposit`: Option that navigates to the **Add Recurring Deposit** form.

#### Add Fixed Deposit Page
- **Description**: Form to input details for a new FD. Includes fields for Deposit Name, Start Date, Bank, Family Member, Principal, Interest Rate, and Tenure.
- **Buttons & Interactions**:
  - `Back`: Returns to the Deposits page or dismisses the form.
  - `Auto Calculate Maturity` (Toggle): Actively toggles automatic calculation of maturity values based on the principal and interest rate.
  - **Compounding Frequency** (Chips): Selectable chips (e.g., Monthly, Quarterly, Annually) to set how interest compounds.
  - **Interest Payout** (Chips): Selectable chips to set payout style (e.g., Cumulative, Monthly payout).
  - `Auto Renewal on Maturity` (Toggle): Switch to enable/disable auto-renewal (functional toggle).
  - `Save as FD`: Submits the form data, closes the view, and returns to the Deposits page.

#### Add Recurring Deposit Page
- **Description**: Form to input details for a new RD. Includes fields for Deposit Name, Start Date, Bank, Family Member, Monthly Deposit, Interest Rate, and Tenure in Months.
- **Buttons & Interactions**:
  - `Back`: Returns to the Deposits page.
  - `Auto Calculate Maturity` (Toggle): Toggles automatic calculation of RD maturity values.
  - **Compounding Frequency** (Chips): Selectable chips for compounding interval.
  - `Save as RD`: Submits the form data, closes the view, and returns to the Deposits page.

### 6. Analytics Page
- **URL Path**: `/` (Analytics View)
- **Description**: A visual dashboard representing the user's portfolio distribution.
- **Buttons & Interactions**:
  - Displays static visual layout blocks/charts for:
    - **Bank Distribution**
    - **Family Portfolio**
    - **FD vs RD Allocation**
  - No interactive buttons beyond the standard bottom navigation bar.

### 7. Settings Page
- **URL Path**: `/` (Settings View)
- **Description**: Configuration and application preferences.
- **Buttons & Interactions**:
  - **Backup & Data**: Options intended for `Backup to Google Drive`, `Restore from Backup`, and `Local Backup (JSON)`.
  - **Export**: Options intended to `Export to Excel` and `Export to PDF`.
  - **Notifications**: Contains functional toggles for `Maturity Reminders` and `RD Installment Reminders`.
  - **Appearance**: A dropdown intended for `Theme` selection (e.g., Light/Dark mode).
  - **Security**: Contains a functional toggle for `App Lock` (biometric/PIN authentication).
  - **About**: Section displaying static application information and versioning.
