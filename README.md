# Cotizador SDI — Seguros Digitales INS

App interna de Juan Carlos Hernández Vargas (agente INS, licencia SUGESE 08-1318) para el envío automatizado de cotizaciones de automóviles.

## Flujo

1. Subir PDF oficial de cotización INS (`ASINS-170-XXXXX`)
2. Revisar datos extraídos automáticamente del PDF
3. Redactar correo con vista previa en vivo
4. Enviar al cliente vía Gmail API con el PDF limpio adjunto

## Infraestructura

- **Producción:** https://cotizador-segurosdigitalesins-sdi.netlify.app
- **Repo:** `jhernandez-vibecode/COTIZADOR-AUTOS` (privado)
- **Deploy:** automático GitHub → Netlify
- **Stack:** HTML + JS vanilla + Tailwind CDN + PDF.js + pdf-lib + Google Identity Services (sin build, sin npm)

## Estructura

```
COTIZADOR-AUTOS/
├── index.html              Shell principal (header + step-nav + 4 vistas)
├── css/styles.css          Variables + estilos de componentes
├── js/
│   ├── config.js           Constantes (Client ID OAuth, remitente, URLs)
│   ├── state.js            Estado global
│   ├── router.js           showView + step-nav
│   ├── pdf-extract.js      Extracción de datos del PDF INS
│   ├── pdf-modify.js       Limpia el PDF (elimina Mensual y Deducción Mensual)
│   ├── email-template.js   HTML del correo al cliente
│   ├── gmail-auth.js       OAuth Gmail (Google Identity Services)
│   ├── mime-builder.js     MIME multipart con PDF adjunto
│   └── app.js              Orquestación y eventos
└── explicacion/            Explicador visual (link en el correo del cotizador)
    ├── index.html
    └── INS BLANCO.png
```

## Contacto

Juan Carlos Hernández Vargas · jhernandez@segurosdelins.com · 8822-1348
