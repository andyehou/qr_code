qr.js is a QR code generator written in JavaScript.
It takes the string data you want to encode, an optional version (between 1 and 40 inclusive), and an optional error correction level (one of 'L', 'M', 'Q', 'H'). Call the draw() function with the <canvas> that you want the QR code to be draw in.

It is used in the index.html demo to display a concept Pebble Time watchface that encodes the current date and time in a QR code that changes every second. The human readable time is display as a color overlay above the QR code. The QR code is still readable due to its built in error correction.

Live Demo:
http://andyehou.github.io/qr_code
