# Database Schema (Google Sheets)

To make the Google Apps Script backend work, please create a new Google Sheet and create the following tabs (sheets) with the exact names below. In each sheet, put the listed headers in the **first row (Row 1)**.

## 1. Sheet Name: `Users`
This sheet stores the users who can log into the system.
*   **Col A:** ID (e.g., U001)
*   **Col B:** Username (e.g., admin)
*   **Col C:** Password (e.g., 1234)
*   **Col D:** Full Name (e.g., ผู้ดูแลระบบ)
*   **Col E:** Role (e.g., admin, user)

## 2. Sheet Name: `Allocations`
Stores the total budget allocated to the school from different sources.
*   **Col A:** ID (e.g., AL001)
*   **Col B:** Source (e.g., งบอุดหนุน, งบกลาง)
*   **Col C:** Amount (e.g., 500000)
*   **Col D:** Year (e.g., 2567)
*   **Col E:** Date Added

## 3. Sheet Name: `Projects`
Stores the projects or activities proposed by teachers.
*   **Col A:** ID (e.g., P001)
*   **Col B:** Project Name
*   **Col C:** Requested Budget
*   **Col D:** Owner (Full Name of creator)
*   **Col E:** Status (e.g., รอตรวจสอบ, อนุมัติ, ไม่อนุมัติ)
*   **Col F:** Created Date

## 4. Sheet Name: `Disbursements`
Stores the actual money spent/withdrawn for approved projects.
*   **Col A:** ID (e.g., D001)
*   **Col B:** Project ID (References Col A in Projects)
*   **Col C:** Amount Disbursed
*   **Col D:** Date
*   **Col E:** Note / Description
*   **Col F:** Status (e.g., รอตรวจสอบ, อนุมัติ)

## 5. Sheet Name: `Settings`
Stores global settings, drop-down options (like Departments, Budget Categories).
*   **Col A:** Setting Type (e.g., Department, BudgetSource)
*   **Col B:** Value (e.g., ฝ่ายวิชาการ, งบอุดหนุน)

---

## How to Deploy the Backend
1. Go to your Google Sheet.
2. Click **Extensions > Apps Script**.
3. Delete any code there, and paste the entire contents of `backend/Code.gs`.
4. Click the blue **Deploy** button > **New deployment**.
5. Select **Web app** (click the gear icon to add it if it's not there).
6. Execute as: **Me**.
7. Who has access: **Anyone**.
8. Click Deploy, authorize the permissions, and copy the **Web app URL**.
9. Paste that URL into `js/api.js` inside the `CONFIG.API_URL` variable.
10. Change `API.USE_MOCK = true;` to `API.USE_MOCK = false;` in `js/api.js`.
