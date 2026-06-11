# Cotizador SDI — Seguros Digitales INS

App interna de Juan Carlos Hernández Vargas (agente INS, licencia SUGESE 08-1318) para el envío automatizado de cotizaciones de automóviles.

## Flujo

1. Subir PDF oficial de cotización INS (`ASINS-170-XXXXX`)
2. Revisar y corregir datos extraídos del PDF (todos los campos editables)
3. Redactar correo con vista previa en vivo
4. Enviar al cliente vía Gmail API con el PDF limpio adjunto · luego compartir la guía por WhatsApp

Envío **solo por Gmail**. El historial de envíos (🕘) queda en el navegador para dar seguimiento.

## Infraestructura

- **Producción:** https://cotizador-segurosdigitalesins-sdi.netlify.app
- **Repo:** `jhernandez-vibecode/COTIZADOR-AUTOS` (privado)
- **Deploy:** automático GitHub → Netlify
- **Stack:** HTML + JS vanilla + PDF.js + pdf-lib + Google Identity Services (sin build, sin npm, sin Tailwind)

## Estructura

```
COTIZADOR-AUTOS/
├── index.html              Shell principal (header + step-nav + 4 vistas + modal historial)
├── 404.html                Página 404 con marca SDI
├── netlify.toml            404 para docs internos + headers de seguridad
├── css/styles.css          Variables + estilos de componentes + toasts + historial
├── js/
│   ├── toast.js            Notificaciones no bloqueantes (reemplaza alert)
│   ├── config.js           Constantes (Client ID Gmail, remitente, URLs)
│   ├── state.js            Estado global
│   ├── agent-profile.js    Perfil del agente en localStorage
│   ├── history.js          Historial de envíos + compartir por WhatsApp
│   ├── router.js           showView + step-nav
│   ├── pdf-extract.js      Extracción de datos del PDF INS
│   ├── pdf-modify.js       Limpia el PDF (elimina Mensual y Deducción Mensual)
│   ├── email-template.js   HTML del correo al cliente
│   ├── gmail-auth.js       OAuth Gmail (Google Identity Services)
│   ├── mime-builder.js     MIME multipart con PDF adjunto
│   └── app.js              Orquestación y eventos
├── cancelacion/            Calculadora de cancelación (Cláusula 33)
├── coberturas/ + detalle/  Coberturas vigentes (agente → cliente)
├── marcas-recargo/         Tabla 56 marcas INS con recargo
└── explicacion/            Explicador visual (link en el correo del cotizador)
```

## Contacto

Juan Carlos Hernández Vargas · jhernandez@segurosdelins.com · 8822-1348
