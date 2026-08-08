/* ==========================================
   CALCULATE FULL TIMER
========================================== */

function calculateFullTimer() {

    const firstIn = document.getElementById("ft_firstIn").value;
    const lastOut = document.getElementById("ft_lastOut").value;
    const position = document.getElementById("ft_position").value;

    if (!firstIn || !lastOut) return;

    const start = new Date("2000-01-01 " + firstIn);
    let end = new Date("2000-01-01 " + lastOut);

    if (end < start) {
        end.setDate(end.getDate() + 1);
    }

    // Work Hours
    const workHours = (end - start) / 3600000;

    document.getElementById("ft_workHours").value =
        workHours.toFixed(2);

    // App Work Hours
    let appHours = 0;

    if (["Sm","Asm","Sc"].includes(position)) {

        appHours = 8;

    } else if (["Sv1","Sv2","Asv","Cm","Fc"].includes(position)) {

        appHours = 8.5;

    }

    document.getElementById("ft_appHours").value = appHours;

    // Approved OT
    let ot = workHours - appHours;

    if (ot < 0) ot = 0;

    ot = Math.floor(ot) + ((ot % 1) >= 0.5 ? 0.5 : 0);

    document.getElementById("ft_approvedOT").value =
        ot.toFixed(1);

}

/* ==========================================
   CALCULATE PART TIMER
========================================== */

function calculatePartTimer(){

    const firstIn = document.getElementById("pt_firstIn").value;
    const lastOut = document.getElementById("pt_lastOut").value;

    if(!firstIn || !lastOut) return;

    const start = new Date("2000-01-01 " + firstIn);
    let end = new Date("2000-01-01 " + lastOut);

    if(end < start){

        end.setDate(end.getDate() + 1);

    }

    // Work Hours
    let workHours = (end - start) / 3600000;

    document.getElementById("pt_workHours").value =
        workHours.toFixed(2);

    // Floor Hours (ikut Excel - floor kepada 0.5 jam)
    let floorHours = Math.floor(workHours * 2) / 2;

    document.getElementById("pt_floorHours").value =
        floorHours.toFixed(1);

    // 1st 4 Hours
    let firstFour = Math.min(floorHours,4);

    document.getElementById("pt_firstFour").value =
        firstFour.toFixed(1);

    // 2nd 4 Hours
    let secondFour = 0;

    if(floorHours > 4){

        secondFour = Math.min(floorHours - 4,4);

    }

    document.getElementById("pt_secondFour").value =
        secondFour.toFixed(1);

    // After 8 Hours
    let afterEight = 0;

    if(floorHours > 8){

        afterEight = floorHours - 8;

    }

    document.getElementById("pt_afterEight").value =
        afterEight.toFixed(1);

}

/* ==========================================
   CALCULATE FOREIGN WORKER
========================================== */

function calculateForeignWorker(){

    const firstIn = document.getElementById("fw_firstIn").value;
    const lastOut = document.getElementById("fw_lastOut").value;

    if(!firstIn || !lastOut) return;

    const start = new Date("2000-01-01 " + firstIn);
    let end = new Date("2000-01-01 " + lastOut);

    if(end < start){

        end.setDate(end.getDate() + 1);

    }

    // Work Hours
    const workHours = (end - start) / 3600000;

    document.getElementById("fw_workHours").value =
        workHours.toFixed(2);

    // Foreign Worker App Hours = 12
    const appHours = 12;

    document.getElementById("fw_appHours").value =
        appHours;

    // Approved OT
    let ot = workHours - appHours;

    if(ot < 0){

        ot = 0;

    }

    ot = Math.floor(ot) + ((ot % 1) >= 0.5 ? 0.5 : 0);

    document.getElementById("fw_approvedOT").value =
        ot.toFixed(1);

}
