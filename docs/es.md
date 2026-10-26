# Huawei Salud

Su cuenta Huawei Salud (Huawei Health) en Gladys: los valores de salud de sus
relojes, pulseras y básculas Huawei (pasos, frecuencia cardiaca, SpO2, estrés,
sueño, peso, temperatura corporal), disparadores y acciones de escena, y tres
widgets de panel.

La integración lee la **nube de Huawei Salud** mediante la API oficial de
Huawei, **Health Service Kit**. Nunca escribe en su cuenta. Su reloj sigue
sincronizándose como siempre con la app Huawei Salud del teléfono; después
Gladys lee la nube.

> **Antes de empezar.** Huawei solo abre Health Service Kit a las aplicaciones
> que ha revisado. Necesita su propia cuenta de desarrollador Huawei (gratuita)
> y una aplicación aprobada: cuente con unos **10 días hábiles** de revisión
> por parte de Huawei. Los pasos están a continuación.

## 1. Crear su aplicación Huawei

1. Cree una cuenta de desarrollador en
   [HUAWEI Developers](https://developer.huawei.com/consumer/es/) y complete la
   verificación de identidad (particular o empresa).
2. En la **Console**, abra **HUAWEI ID** → **Apply for HUAWEI ID**. Elija el
   tipo de producto **Server app** (o **Web app**), cree el producto y, en
   **Callback URL**, introduzca la URI de redirección que Gladys muestra bajo
   el botón **Conectar** de la integración (por defecto
   `https://my.gladysassistant.com/redirect/oauth`).
3. Anote el **App ID** (Client ID) y el **App secret** (Client secret).
4. En la Console, abra **Health Service Kit** → **Apply for Health Service
   Kit**, elija el mismo producto y marque los permisos de **lectura** de los
   datos que desee, como mínimo:
   - Actividad: **Steps**, **Calories**, **Distance**;
   - Salud: **Heart rate**, **SpO2**, **Stress**, **Body temperature**,
     **Body fat** (peso), **Sleep**.
     Rellene el formulario de solicitud que proporciona Huawei (describa un uso
     doméstico de domótica personal) y envíelo.
5. Espere el correo de Huawei (unos 10 días hábiles). Los permisos se pueden
   usar unas 24 horas después de la aprobación.

A tener en cuenta:

- La aprobación de prueba admite hasta 100 usuarios: de sobra para un hogar.
- Huawei indica que los desarrolladores particulares solo obtienen el nivel de
  apertura «básico» y pueden tener que publicar una app móvil; si su solicitud
  se rechaza por ese motivo, una cuenta de desarrollador de empresa es la
  solución documentada.
- Huawei solo comparte los datos generados **después** de vincular su cuenta
  (sin historial anterior a la autorización).

## 2. Configurar la integración

1. Abra la pestaña **Configuración** de la integración.
2. Introduzca el **Client ID** y el **Client secret**.
3. En **Datos que leer**, deje solo lo que su aplicación tiene aprobado:
   Huawei rechaza la conexión si un permiso no fue concedido.
4. Ajustes opcionales: intervalo de actualización (15 minutos por defecto, 5
   como mínimo), zona horaria (para saber qué día es «hoy»), objetivo diario
   de pasos y umbrales de alerta (frecuencia cardiaca alta/baja, SpO2 bajo).
5. **Guarde**, haga clic en **Conectar** e inicie sesión con el **HUAWEI ID**
   que usa su app Huawei Salud.
6. En el teléfono, en la app **Huawei Salud**, abra **Yo → Gestión de
   privacidad** y permita compartir datos con Health Kit (la acción **Probar
   la conexión** le avisa si falta).

## 3. Dispositivos

Abra la pestaña **Descubrimiento** y añada **Huawei Health - <su nombre>**.
Contiene una función de solo lectura por valor:

| Valor                                             | Grupo               |
| ------------------------------------------------- | ------------------- |
| Pasos, calorías activas, distancia (de hoy)       | Actividad           |
| Frecuencia cardiaca, FC en reposo, VFC            | Frecuencia cardiaca |
| Oxígeno en sangre (SpO2)                          | Oxígeno en sangre   |
| Puntuación de estrés                              | Estrés              |
| Temperatura corporal y cutánea                    | Temperatura         |
| Peso, índice de masa corporal, grasa corporal     | Peso                |
| Puntuación de sueño, total, profundo, ligero, REM | Sueño               |

Huawei combina todos los dispositivos de la cuenta (reloj, pulsera, báscula,
teléfono): el historial se conserva al cambiar de reloj. Un valor que sus
dispositivos no miden queda vacío. La acción **Probar la conexión** y el
widget de resumen muestran los dispositivos que Huawei conoce.

## Acciones

- **Probar la conexión**: comprueba la autorización de Huawei y el permiso de
  la app Salud, y muestra sus dispositivos.
- **Sincronizar ahora**: lee la nube de Huawei inmediatamente.
- **Cerrar sesión**: elimina los tokens de Huawei de Gladys. Para revocar el
  acceso por completo, quite también la aplicación de su HUAWEI ID (ajustes de
  la cuenta → privacidad).

## Disparadores de escena

| Disparador                         | Cuándo                                                 | Variables                                               |
| ---------------------------------- | ------------------------------------------------------ | ------------------------------------------------------- |
| Noche de sueño registrada          | una nueva noche llega a la nube                        | puntuación, duración, sueño profundo, hora de despertar |
| Objetivo diario de pasos alcanzado | los pasos de hoy superan el objetivo (una vez al día)  | pasos, objetivo                                         |
| Frecuencia cardiaca anómala        | una nueva medición cruza un umbral (filtro: alta/baja) | frecuencia cardiaca, sentido                            |
| Oxígeno en sangre bajo             | una nueva medición de SpO2 baja del umbral             | SpO2                                                    |
| Nuevo pesaje                       | un nuevo peso llega a Huawei Salud                     | peso, IMC, grasa corporal                               |

La primera lectura tras un reinicio es un punto de referencia: nunca dispara
nada.

## Acciones de escena

- **Sincronizar Huawei Salud**: salida `synced`.
- **Obtener el resumen de salud** (opción: sincronizar primero): pasos,
  calorías activas, distancia, frecuencia cardiaca, FC en reposo, SpO2,
  estrés, peso, puntuación y duración del sueño, hora de la última
  sincronización. Ejemplo: «Has dormido {{sleep_minutes}} minutos, puntuación
  {{sleep_score}}».

## Widgets de panel

- **Huawei Salud**: pasos, frecuencia cardiaca, SpO2, estrés, puntuación de
  sueño y peso, con la cuenta, la última sincronización y sus dispositivos, y
  un botón Actualizar.
- **Actividad Huawei**: indicador del objetivo de pasos, calorías activas,
  distancia y gráfico de los últimos 7 días.
- **Sueño Huawei**: puntuación y fases de la última noche, horas de dormirse y
  de despertar, y la curva de frecuencia cardiaca de las últimas 24 h (el
  dispositivo debe estar creado en Gladys).

## Solución de problemas

- **«Haga clic en Conectar»**: la cuenta no está vinculada o el Client ID ha
  cambiado.
- **Algunos datos no se pudieron leer**: el permiso no está concedido a su
  aplicación, o no estaba marcado al hacer clic en Conectar. Corríjalo en la
  consola de Huawei y vuelva a hacer clic en **Conectar**.
- **Ningún dato pero «conectado»**: permita compartir datos en la app Huawei
  Salud (Yo → Gestión de privacidad) y espere a que el reloj se sincronice con
  el teléfono.
- **«Autorización caducada»**: el token de Huawei dura unos seis meses y
  caduca si cambia la contraseña de su HUAWEI ID: vuelva a hacer clic en
  **Conectar**.
- Las cuentas registradas fuera de Europa las atiende otro sitio de Huawei: la
  integración lo encuentra por sí sola.
