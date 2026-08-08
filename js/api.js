/*************************************************
 * Manual OT Claim System
 * api.js
 *************************************************/

/* ==========================================
   API CALL
========================================== */

async function callAPI(action, data = {}) {

    const controller = new AbortController();

    const timeout = setTimeout(() => {

        controller.abort();

    }, 10000);

    try {

        const formData = new FormData();

        formData.append(
            "payload",
            JSON.stringify({
                action,
                data
            })
        );

        const response = await fetch(CONFIG.WEB_APP_URL, {
            method: "POST",
            body: formData,
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {

            throw new Error("HTTP " + response.status);

        }

        return await response.json();

    } catch (err) {

        clearTimeout(timeout);

        if (err.name === "AbortError") {

            return {
                status: false,
                message: "Server Timeout"
            };

        }

        return {
            status: false,
            message: err.message
        };

    }

}

/* ==========================================
   INTERNET CHECK
========================================== */

function checkInternet() {

    if (!navigator.onLine) {

        Swal.fire({

            icon: "error",

            title: "No Internet Connection",

            text: "Please check your internet connection and try again.",

            confirmButtonColor: "#C1121F"

        });

        return false;

    }

    return true;

}
