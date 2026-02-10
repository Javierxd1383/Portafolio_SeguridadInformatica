document.addEventListener('DOMContentLoaded', () => {

    // Typewriter Effect
    const textToType = ["Francisco Javier Cruz Juarez", "ID: 177622", "Javierxd1383"];
    const typeContainer = document.getElementById('typewriter');
    let lineIndex = 0;
    let charIndex = 0;

    function type() {
        if (lineIndex < textToType.length) {
            if (charIndex < textToType[lineIndex].length) {
                typeContainer.textContent += textToType[lineIndex].charAt(charIndex);
                charIndex++;
                setTimeout(type, 100);
            } else {
                setTimeout(erase, 2000);
            }
        } else {
            lineIndex = 0; // Loop forever
            setTimeout(type, 500);
        }
    }

    function erase() {
        if (charIndex > 0) {
            typeContainer.textContent = textToType[lineIndex].substring(0, charIndex - 1);
            charIndex--;
            setTimeout(erase, 50);
        } else {
            lineIndex++;
            setTimeout(type, 500);
        }
    }

    type();

    // Smooth Scroll
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });

    // Form Handling
    const form = document.getElementById('neonForm');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const btn = form.querySelector('button');
            const originalText = btn.innerText;

            // Obtener datos del formulario
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const message = document.getElementById('message').value;

            // Simulando envío inicial
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> CONECTANDO CON SERVIDOR...';

            // Recopilar datos automáticamente del formulario (incluye hidden fields)
            const formData = new FormData(form);

            // Envío real con Fetch a la dirección CORREGIDA
            fetch("https://formsubmit.co/ajax/javiercruzz1383@gmail.com", {
                method: "POST",
                body: formData
            })
                .then(response => response.json())
                .then(data => {
                    btn.innerHTML = '✅ MENSAJE ENVIADO CON ÉXITO';
                    btn.style.background = '#00ff00'; // Green

                    // Mostrar respuesta visual
                    const reply = document.getElementById('autoReply');
                    if (reply) {
                        reply.style.display = 'block';
                        reply.innerHTML = ">> ¡Recibido! Tu mensaje ha llegado a mi servidor corriendo a 125ms.";
                    }

                    form.reset();
                    setTimeout(() => {
                        btn.innerHTML = originalText;
                        btn.style.background = '';
                        btn.style.color = '';
                        if (reply) reply.style.display = 'none';
                    }, 6000);
                })
                .catch(error => {
                    console.error("Error:", error);
                    btn.innerHTML = '❌ ERROR DE CONEXIÓN';
                    btn.style.background = '#ff0000';
                });
        });
    }

    // Party Mode on Click
    document.addEventListener('click', (e) => {
        createSparkle(e.clientX, e.clientY);
    });

    function createSparkle(x, y) {
        const sparkle = document.createElement('div');
        sparkle.style.position = 'fixed';
        sparkle.style.left = x + 'px';
        sparkle.style.top = y + 'px';
        sparkle.style.width = '10px';
        sparkle.style.height = '10px';
        sparkle.style.background = ['#ff007f', '#00f3ff', '#ffe600'][Math.floor(Math.random() * 3)];
        sparkle.style.borderRadius = '50%';
        sparkle.style.pointerEvents = 'none';
        sparkle.style.zIndex = '9999';
        sparkle.animate([
            { transform: 'scale(0) translate(0, 0)', opacity: 1 },
            { transform: 'scale(2) translate(' + (Math.random() * 100 - 50) + 'px, ' + (Math.random() * 100 - 50) + 'px)', opacity: 0 }
        ], {
            duration: 500,
            fill: 'forwards'
        });

        document.body.appendChild(sparkle);
        setTimeout(() => sparkle.remove(), 500);
    }



    // --- JUEGO ANTERIOR ELIMINADO ---
    // El nuevo juego "Cyber Runner" se maneja en game.js


});
