# Comprobación personal de Jaime en iPhone

Estado: pendiente. Esta ficha no certifica una prueba física.

Usar después de la admisión y publicación de la corrección. Jaime, o una persona autorizada expresamente para utilizar su teléfono, realiza la prueba. No enviar códigos de acceso, capturas con datos privados ni conversaciones personales al repositorio.

Aplicación: https://jaime.nova-era.fr/ojo/jaime/start.html

## Apertura y conversación

1. Anotar fecha y hora, modelo de iPhone, versión de iOS y modo utilizado: Safari o icono de inicio.
2. Abrir el enlace en Safari e identificarse con la cuenta personal autorizada. Una pantalla que solicite autenticación no prueba una avería de Ollama.
3. Entrar en Conversar. Si se solicita permiso para conservar la conversación, decidir expresamente; no activar el permiso por defecto para completar esta ficha.
4. Enviar: «Mi tema de referencia es Miura. ¿Qué diferencia hay entre ganadería y encaste?»
5. Comprobar que llega una respuesta real en español, con hechos respaldados por las referencias disponibles. La biblioteca local no es una búsqueda web en directo.
6. Preguntar: «¿Cuál era mi tema? ¿1842 y 1849 son fechas contradictorias?» Comprobar que conserva Miura y distingue formación y antigüedad. Contrastar con la receta de 18 casos para la aceptación factual completa.
7. Escribir un borrador sin enviarlo. Ocultar el teclado, desplazarse por la respuesta, cerrar la aplicación y abrirla de nuevo. Comprobar borrador, tema, conversación y legibilidad.

## Regreso desde Cloudflare y pantalla de inicio

8. Después de una autenticación necesaria, recargar una vez. No debe aparecer `JAIME_BROWSER_AUTHORITY_REJECTED`. Anotar el mensaje exacto si aparece; no copiar cookies ni JWT.
9. Usar Compartir → Añadir a la pantalla de inicio si Safari ofrece esa opción. Cerrar las pestañas anteriores y abrir el icono para permitir el ciclo normal de actualización del service worker.
10. Repetir la apertura y una relance desde el icono. Registrar si el navegador solicita una autenticación propia de este modo. No dar por supuesta una sesión compartida entre Safari y la aplicación instalada.
11. Si la sesión sigue válida, comprobar que no se exige un código innecesario. Si ha expirado o se ha revocado, la autenticación debe volver a exigirse. No extender la duración durante la prueba.

## Interrupción, voz y privacidad

12. En una conversación de prueba, enviar una pregunta y cortar temporalmente la red. Recuperarla y usar la comprobación de respuesta disponible. Verificar una sola pregunta aceptada y una sola respuesta, sin reenviar el mensaje incierto. Conservar el borrador en caso de fallo.
13. Comprobar los controles de voz que realmente ofrezca el dispositivo. Anotar por separado grabación, transcripción, respuesta y reproducción. Un texto o un guion no constituye un audio generado.
14. Con la red desconectada, la aplicación debe explicar la limitación. La autenticación y el asistente privado necesitan conexión; una pantalla visible en caché no prueba acceso al backend.
15. Verificar que la libreta local sigue identificada como no cifrada. La mejora de conexión no cifra automáticamente las notas. No activar notificaciones durante esta prueba.

## Resultado a devolver

- Persona que realizó la prueba y autorización para utilizar el dispositivo, sin añadir identificadores de cuenta.
- Fecha, iOS, modo y versión candidata mostrada o referencia de publicación.
- Resultado de apertura, primer regreso Cloudflare, dos respuestas reales, contexto, borrador, cierre/reapertura, interrupción y ausencia de duplicado.
- Resultado de voz/audio, indicando explícitamente las capacidades no disponibles.
- Mensajes de error exactos, sin códigos, cookies, tokens ni contenido privado.

La livraison reste ouverte tant que ce résultat physique n'est pas attesté. Aucun test simulé ne remplit cette fiche à la place de Jaime.
