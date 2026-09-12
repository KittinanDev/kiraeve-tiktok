# 🚀 คู่มือการ Release อัปเดต Kiraeve TikTok (Auto-Updater Guide)

## ภาพรวมกระบวนการ (Flow Overview)

```
คุณแก้โค้ด → เพิ่มเลข version → รัน npm run release → ไฟล์ขึ้น GitHub Releases
                                                              ↓
                                              แอปผู้ใช้เช็กอัตโนมัติ → แจ้งเตือน → ดาวน์โหลด → ติดตั้ง
```

---

## ขั้นตอนที่ 1: ตั้งค่า GitHub Repository

1. สร้าง Repository บน GitHub ชื่อ **`kiraeve-tiktok`** (ต้องตรงกับ `package.json`)
2. ไปที่ **Settings → Secrets and variables → Actions**
3. เพิ่ม Secret ชื่อ **`GH_TOKEN`** โดยไปที่ GitHub Profile → Settings → Developer settings → Personal access tokens → Generate new token (classic)
   - ติ๊ก Permission: **`repo`** (ทั้งหมด) และ **`workflow`**

---

## ขั้นตอนที่ 2: วิธี Release เวอร์ชันใหม่ (ทำทุกครั้งที่อยากอัปเดต)

### 2.1 อัปเดตเลข Version ใน `package.json`

```json
{
  "version": "1.1.0"   // ← เปลี่ยนเลขตรงนี้ทุกครั้ง
}
```

**กฎการตั้งเลขเวอร์ชัน (Semantic Versioning)**:
| เลขที่เปลี่ยน | ใช้เมื่อ | ตัวอย่าง |
|---|---|---|
| **MAJOR** (1.x.x → 2.x.x) | เปลี่ยนแปลงใหญ่มาก ไม่ Compatible | v1.0.0 → v2.0.0 |
| **MINOR** (x.1.x → x.2.x) | เพิ่มฟีเจอร์ใหม่ ยัง Compatible | v1.0.0 → v1.1.0 |
| **PATCH** (x.x.1 → x.x.2) | แก้บั๊ก / ปรับ UI เล็กน้อย | v1.0.0 → v1.0.1 |

### 2.2 ติดตั้ง Dependencies ครั้งแรก

```bash
npm install
```

### 2.3 Build & Upload Release (วิธีที่ 1: Manual)

```bash
# ตั้งค่า Token ก่อน (ทำครั้งเดียว)
set GH_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx

# Build และ Upload ขึ้น GitHub Releases อัตโนมัติ
npm run release
```

> **ผลลัพธ์**: ไฟล์ต่อไปนี้จะปรากฏใน GitHub Releases อัตโนมัติ:
> - `Kiraeve-TikTok-Setup-1.1.0.exe` — ตัวติดตั้ง
> - `latest.yml` — Manifest ที่แอปใช้เช็กเวอร์ชัน

---

## ขั้นตอนที่ 3: ตั้งค่า GitHub Actions (อัตโนมัติทุกครั้งที่ push tag) — แนะนำ!

สร้างไฟล์ `.github/workflows/release.yml`:

```yaml
name: Build & Release Kiraeve TikTok

on:
  push:
    tags:
      - 'v*'   # trigger เมื่อ push tag เช่น v1.1.0

jobs:
  release:
    runs-on: windows-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build & Publish to GitHub Releases
        env:
          GH_TOKEN: ${{ secrets.GH_TOKEN }}
        run: npm run release
```

### วิธีใช้ GitHub Actions:

```bash
# 1. Commit โค้ดทั้งหมด
git add .
git commit -m "feat: เพิ่มระบบอัปเดตอัตโนมัติ v1.1.0"

# 2. สร้าง Tag ตามเลข version
git tag v1.1.0

# 3. Push ทั้ง code และ tag
git push origin main
git push origin v1.1.0

# GitHub Actions จะ Build และ Upload .exe + latest.yml ให้อัตโนมัติ 🎉
```

---

## ขั้นตอนที่ 4: โครงสร้างไฟล์ที่จะเกิดขึ้นบน GitHub Releases

```
GitHub Releases → v1.1.0
├── Kiraeve-TikTok-Setup-1.1.0.exe      ← ตัวติดตั้งหลัก (ผู้ใช้ใหม่ดาวน์โหลด)
├── Kiraeve-TikTok-Setup-1.1.0.exe.blockmap  ← Delta/Patch สำหรับ incremental update
└── latest.yml                          ← Manifest (แอปจะ fetch ไฟล์นี้ตอนเช็กอัปเดต)
```

ตัวอย่าง `latest.yml` (สร้างอัตโนมัติโดย electron-builder):
```yaml
version: 1.1.0
files:
  - url: Kiraeve-TikTok-Setup-1.1.0.exe
    sha512: abc123==
    size: 68000000
path: Kiraeve-TikTok-Setup-1.1.0.exe
sha512: abc123==
releaseDate: '2026-09-15T00:00:00.000Z'
```

---

## ขั้นตอนที่ 5: เพิ่ม Release Notes (ข้อความแสดงบน Modal)

เมื่อ Push Tag ไปที่ GitHub ให้แก้ไข Release Description บน GitHub.com:
1. ไปที่ Releases → v1.1.0 → Edit Release
2. เพิ่ม Description (รองรับ Markdown):
   ```
   ## What's New in v1.1.0
   - ✨ ยกเครื่อง UI/UX สไตล์ Minimalist Kiraeve TikTok
   - 🎰 ปรับปรุง CS:GO Gacha Wheel: ตั้งชื่อ Rarity ได้
   - 🔧 แก้ไขบั๊กระบบเสียง TTS
   ```

---

## สรุปย่อ: ทำอัปเดตครั้งต่อไปแค่ 4 คำสั่ง

```bash
# แก้โค้ด แล้วรัน:
git add .
git commit -m "fix: แก้บั๊ก xxx"
git tag v1.0.1
git push origin main && git push origin v1.0.1
```

GitHub Actions จะ Build และอัปโหลด `.exe` + `latest.yml` ให้เองอัตโนมัติ
แอปของผู้ใช้จะแจ้งเตือนมีอัปเดตใหม่ภายใน 5 นาทีหลังเปิดแอปครั้งถัดไป! 🎉

---

## FAQ — คำถามที่พบบ่อย

**Q: ทำไมเปิดแอปบน dev mode (npm start) แล้วเช็กอัปเดตไม่ได้?**
> A: `electron-updater` ทำงานได้เฉพาะ `.exe` ที่ติดตั้งแล้วเท่านั้น ตอน dev จะเห็น error "ENOENT: latest.yml not found" เป็นเรื่องปกติ

**Q: ผู้ใช้ไม่ต้องทำอะไรเพิ่มเติมเลยใช่ไหม?**
> A: ใช่! แอปจะตรวจสอบอัตโนมัติทุกครั้งที่เปิด (หลัง 5 วินาที) ถ้ามีอัปเดตจะแจ้งเตือนผ่าน Modal

**Q: ต้องจ่ายเงิน GitHub ไหม?**
> A: ไม่ — GitHub Releases สำหรับ Public Repository ฟรีสมบูรณ์ GitHub Actions ก็ฟรี 2,000 นาทีต่อเดือนสำหรับ Private Repository (เพียงพอมาก)
