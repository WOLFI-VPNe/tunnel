# 🚀 WOLFI Tunnel

یک اسکریپت ساده برای نصب و مدیریت سرویس‌های Tunnel روی Linux VPS.

## ✨ Features

* نصب سریع با یک دستور
* پشتیبانی از Linux VPS
* نصب و مدیریت Tunnel
* تنظیمات ساده
* مناسب برای مدیریت چند سرور
* اجرای مستقیم از GitHub

## ⚡ نصب سریع

برای اجرای آخرین نسخه:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/WOLFI-VPNe/tunnel/main/wolfi.sh)
```

یا ابتدا پروژه را Clone کنید:

```bash
git clone https://github.com/WOLFI-VPNe/tunnel.git
cd tunnel
chmod +x wolfi.sh
./wolfi.sh
```

## 📦 فایل‌های پروژه

```text
tunnel/
├── configs/
├── panel/
├── wolfi/
│   └── wolfi-core/
├── backhaul.sh
├── backhaul_premium
├── wolfi.sh
├── wolfi.tar.gz
└── wolfi_premium
```

## 🖥️ سیستم موردنیاز

* Linux VPS
* دسترسی `root`
* اتصال اینترنت
* پیشنهاد می‌شود از سیستم‌عامل‌های رایج مانند Ubuntu یا Debian استفاده شود.

## 🔥 اجرای اسکریپت

پس از اجرای دستور نصب، منوی اسکریپت نمایش داده می‌شود و می‌توانید گزینه موردنظر خود را انتخاب کنید:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/WOLFI-VPNe/tunnel/main/wolfi.sh)
```

> ⚠️ قبل از اجرای هر اسکریپت دریافت‌شده از اینترنت، کد آن را بررسی کنید و فقط روی سروری اجرا کنید که کنترل آن را در اختیار دارید.

## 🔄 Update

برای دریافت آخرین نسخه:

```bash
cd tunnel
git pull
```

یا اجرای مستقیم نسخه موجود در GitHub:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/WOLFI-VPNe/tunnel/main/wolfi.sh)
```

## 📜 License

این پروژه برای استفاده در محیط‌های مجاز و سرورهایی که مالک یا مدیر آن هستید ارائه شده است.

## ⭐ Support

اگر پروژه برای شما مفید بود، می‌توانید به ریپو Star ⭐ بدهید.

**Repository:**
https://github.com/WOLFI-VPNe/tunnel
