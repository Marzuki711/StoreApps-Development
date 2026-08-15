/* DASHBOARD UI LOCK — ONLY REQUESTED VISUAL FIXES */
/*
 * Store Apps - Home Sales Dashboard
 * ============================================================
 * DASHBOARD UI LOCK
 * Data/API logic only. Do not change Dashboard layout/design.
 * ============================================================
 */

let homeSalesDate = "";
let homeSalesStores = [];
let homeSalesDashboardInitialized = false;

function homeCurrentUser(){
    try{
        if(typeof getCurrentUser === "function"){
            return getCurrentUser() || {};
        }
    }catch(e){}

    try{
        if(typeof currentUser !== "undefined" && currentUser){
            return currentUser;
        }
    }catch(e){}

    try{
        return JSON.parse(sessionStorage.getItem("currentUser") || "{}");
    }catch(e){
        return {};
    }
}

function homeYesterdayISO(){
    const d = new Date();
    d.setDate(d.getDate() - 1);

    return [
        d.getFullYear(),
        String(d.getMonth()+1).padStart(2,"0"),
        String(d.getDate()).padStart(2,"0")
    ].join("-");
}

function homePreviousWeekISO(iso){
    const parts = String(iso || "").split("-").map(Number);
    if(parts.length !== 3 || parts.some(Number.isNaN)) return "";

    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() - 7);

    return [
        d.getFullYear(),
        String(d.getMonth()+1).padStart(2,"0"),
        String(d.getDate()).padStart(2,"0")
    ].join("-");
}

function homeWeeklyDates(endISO){
    const parts = String(endISO || "").split("-").map(Number);
    if(parts.length !== 3 || parts.some(Number.isNaN)) return [];

    const end = new Date(parts[0], parts[1] - 1, parts[2]);
    const dates = [];

    for(let i = 6; i >= 0; i--){
        const d = new Date(end);
        d.setDate(end.getDate() - i);
        dates.push([
            d.getFullYear(),
            String(d.getMonth()+1).padStart(2,"0"),
            String(d.getDate()).padStart(2,"0")
        ].join("-"));
    }

    return dates;
}

function homeWeeklyApsdFromResponses(responses,totalStores){
    const storeCount = Number(totalStores) || 0;
    if(!storeCount) return { sales:0, customer:0 };

    let sales = 0;
    let customer = 0;

    (Array.isArray(responses) ? responses : []).forEach(response => {
        const rows =
            response && response.status && Array.isArray(response.rows)
                ? response.rows
                : [];

        rows.forEach(row => {
            sales +=
                Number(String(row.totalMerchandiseSales ?? "").replace(/,/g,"")) || 0;
            customer +=
                Number(String(row.totalCustomer ?? "").replace(/,/g,"")) || 0;
        });
    });

    // APSD is based on ALL stores and ALL 7 days in the period.
    // A store that has not submitted contributes zero for that day;
    // the denominator remains total stores x 7.
    const denominator = storeCount * 7;

    return {
        sales: sales / denominator,
        customer: customer / denominator
    };
}

function homeSetWeeklyApsdPeriod(id,startISO,endISO){
    homeSetText(
        id,
        homeDisplayDate(startISO) + " – " + homeDisplayDate(endISO)
    );
}

function homeSetWeeklyApsdChange(id,current,previous){
    homeSetWowChange(id,current,previous);
}

function homeSetWowChange(id, current, previous){
    const el = document.getElementById(id);
    if(!el) return;

    const now = Number(current) || 0;
    const old = Number(previous) || 0;
    const pct = old !== 0 ? ((now - old) / Math.abs(old)) * 100 : (now > 0 ? 100 : 0);
    const direction = pct > 0.004 ? "up" : pct < -0.004 ? "down" : "flat";

    el.className = "sa-wow-change is-" + direction;
    el.innerHTML =
        (direction === "up"
            ? '<i class="fa-solid fa-arrow-trend-up"></i>'
            : direction === "down"
                ? '<i class="fa-solid fa-arrow-trend-down"></i>'
                : '<i class="fa-solid fa-minus"></i>') +
        '<strong>' + Math.abs(pct).toFixed(2) + '%</strong>';
}


/* DASHBOARD DATE FORMAT LOCK — only display/input conversion */
function homeISOToDDMMYYYY(iso){
    const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || "");
}

function homeDDMMYYYYToISO(value){
    const m = String(value || "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if(!m) return "";

    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    const d = new Date(year, month - 1, day);

    if(
        d.getFullYear() !== year ||
        d.getMonth() !== month - 1 ||
        d.getDate() !== day
    ){
        return "";
    }

    return `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
}

function homeSetDashboardDatePicker(iso){
    const picker = document.getElementById("homeSalesDatePicker");
    if(picker) picker.value = iso || "";
}

function homeGetDashboardSelectedISO(){
    const input = document.getElementById("homeSalesDate");
    if(!input) return homeSalesDate || homeYesterdayISO();

    const iso = homeDDMMYYYYToISO(input.value);
    return iso || homeSalesDate || homeYesterdayISO();
}

function homeOpenDashboardDatePicker(){
    const picker = document.getElementById("homeSalesDatePicker");
    if(!picker) return;

    homeSetDashboardDatePicker(homeGetDashboardSelectedISO());

    try{
        if(typeof picker.showPicker === "function"){
            picker.showPicker();
        }else{
            picker.click();
        }
    }catch(e){
        picker.click();
    }
}

function homeMoney(value){
    const n = Number(String(value ?? "").replace(/,/g,"")) || 0;

    return n.toLocaleString("en-MY",{
        minimumFractionDigits:2,
        maximumFractionDigits:2
    });
}

function homeNumber(value){
    const n = Number(String(value ?? "").replace(/,/g,"")) || 0;

    return n.toLocaleString("en-MY",{
        maximumFractionDigits:0
    });
}

function homePercent(value){
    const n = Number(value) || 0;
    return n.toFixed(2) + "%";
}

function homeDisplayDate(iso){
    if(!iso) return "—";

    const parts = String(iso).split("-");
    if(parts.length !== 3) return iso;

    const d = new Date(
        Number(parts[0]),
        Number(parts[1])-1,
        Number(parts[2])
    );

    return d.toLocaleDateString("en-GB",{
        day:"2-digit",
        month:"long",
        year:"numeric"
    });
}

function homeSetText(id,value){
    const el = document.getElementById(id);

    if(el && value !== undefined && value !== null){
        el.textContent = value;
    }
}

function homeSetLoading(show){
    const el = document.getElementById("homeSalesLoading");

    if(el){
        el.style.display = show ? "flex" : "none";
    }
}

function homeSetGreeting(){
    const user = homeCurrentUser();

    const name = String(
        user.fullName ||
        user.name ||
        user.username ||
        "User"
    ).trim();

    const hour = new Date().getHours();

    const part =
        hour < 12
            ? "Good Morning"
            : hour < 18
                ? "Good Afternoon"
                : "Good Evening";

    const el = document.querySelector("[data-home-greeting]");

    if(el){
        el.textContent = part + ", " + name;
    }
}

function homeSetDashboardDate(date){
    const input = document.getElementById("homeSalesDate");
    const picker = document.getElementById("homeSalesDatePicker");

    if(input){
        input.value = homeISOToDDMMYYYY(date);
    }

    if(picker){
        picker.value = date || "";
    }
}

function homeResetDashboard(){
    const values = {
        homeTotalSales:"0.00",
        homeApsdSales:"0.00",
        homeTotalCustomer:"0",
        homeApsdCustomer:"0",

        homeWowApsdSales:"0.00",
        homeWowLastApsdSales:"0.00",
        homeWowApsdCustomer:"0",
        homeWowLastApsdCustomer:"0",

        homeWeeklyApsdSales:"0.00",
        homeWeeklyLastApsdSales:"0.00",
        homeWeeklyApsdCustomer:"0",
        homeWeeklyLastApsdCustomer:"0",

        homeSubmittedStores:"0",
        homeTotalStores:"0",
        homeSubmittedLabel:"0 SUBMITTED",
        homePendingStores:"0 PENDING",
        homeSubmissionPct:"0%",

        homeBudgetPct:"0.00%",
        homeApsdBudgetActual:"0.00",
        homeApsdBudgetTarget:"0.00",
        homeBudgetCaption:"0.00% of Budget Achieved",

        homeTotalRecord:"0",
        homeBusinessDate:"—"
    };

    Object.keys(values).forEach(id=>{
        homeSetText(id,values[id]);
    });

    const donut = document.getElementById("homeSubmissionDonut");
    const budget = document.getElementById("homeBudgetBar");

    if(donut){
        donut.style.background =
            "conic-gradient(#C1121F 0deg,#E5E7EB 0deg 360deg)";
    }

    if(budget){
        budget.style.width = "0%";
    }
}


function homeMtdDates(endISO){
    const parts = String(endISO || "").split("-").map(Number);
    if(parts.length !== 3 || parts.some(Number.isNaN)) return [];
    const end = new Date(parts[0], parts[1] - 1, parts[2]);
    const start = new Date(parts[0], parts[1] - 1, 1);
    const dates = [];
    for(let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)){
        dates.push([
            d.getFullYear(),
            String(d.getMonth()+1).padStart(2,"0"),
            String(d.getDate()).padStart(2,"0")
        ].join("-"));
    }
    return dates;
}

function homeParseDateISO(value){
    const text = String(value || "").trim();
    let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if(m){
        const y=Number(m[1]), mo=Number(m[2]), d=Number(m[3]);
        const dt=new Date(y,mo-1,d);
        return (dt.getFullYear()===y && dt.getMonth()===mo-1 && dt.getDate()===d)
            ? `${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}` : "";
    }
    m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if(m){
        const d=Number(m[1]), mo=Number(m[2]), y=Number(m[3]);
        const dt=new Date(y,mo-1,d);
        return (dt.getFullYear()===y && dt.getMonth()===mo-1 && dt.getDate()===d)
            ? `${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}` : "";
    }
    return "";
}

function homeCalendarDaysInclusive(startISO,endISO){
    const a=String(startISO||"").split("-").map(Number);
    const b=String(endISO||"").split("-").map(Number);
    if(a.length!==3 || b.length!==3 || a.some(Number.isNaN) || b.some(Number.isNaN)) return 0;
    const start=new Date(a[0],a[1]-1,a[2]);
    const end=new Date(b[0],b[1]-1,b[2]);
    const diff=Math.round((end-start)/86400000)+1;
    return diff>0 ? diff : 0;
}

function homeStoreKey(value){
    const digits=String(value || "").replace(/\D/g,"");
    return digits ? digits.padStart(4,"0") : "";
}

function homeRenderMtdStorePerformance(records, selectedDate){
    const section=document.getElementById("homeMtdStorePerformance");
    const body=document.getElementById("homeMtdStoreBody");
    const count=document.getElementById("homeMtdStoreCount");
    const period=document.getElementById("homeMtdStorePeriod");
    if(!section || !body) return;

    const rows=Array.isArray(records) ? records.slice() : [];
    rows.sort((a,b)=>{
        const diff=(Number(b.mtdSales)||0)-(Number(a.mtdSales)||0);
        if(diff!==0) return diff;
        return String(a.storeNo||"").localeCompare(String(b.storeNo||""),undefined,{numeric:true,sensitivity:"base"});
    });

    if(count) count.textContent=`${rows.length} STORE${rows.length===1?"":"S"}`;
    if(period) period.textContent=`MTD THROUGH ${homeDisplayDate(selectedDate)}`;

    if(!rows.length){
        section.style.display="none";
        body.innerHTML="";
        return;
    }

    section.style.display="block";

    const totalSales=rows.reduce((sum,row)=>sum+(Number(row.mtdSales)||0),0);
    const totalCustomer=rows.reduce((sum,row)=>sum+(Number(row.customer)||0),0);
    const totalApsdSales=rows.reduce((sum,row)=>sum+(Number(row.apsdSales)||0),0);
    const totalApsdBudget=rows.reduce((sum,row)=>sum+(Number(row.apsdBudget)||0),0);
    const totalVariance=totalApsdSales-totalApsdBudget;
    const storeCount=rows.length;
    const avgSales=storeCount ? totalSales/storeCount : 0;
    const avgCustomer=storeCount ? totalCustomer/storeCount : 0;
    const avgApsdSales=storeCount ? totalApsdSales/storeCount : 0;
    const avgApsdBudget=storeCount ? totalApsdBudget/storeCount : 0;
    const avgVariance=avgApsdSales-avgApsdBudget;

    const renderStatus=(variance)=>{
        const numeric=Number(variance);
        const status=Number.isFinite(numeric) ? (numeric<0 ? "Not Achieved" : "Achieved") : "";
        const statusClass=numeric<0 ? "is-not-achieved" : "is-achieved";
        return `<span class="sa-mtd-status ${statusClass}">${status}</span>`;
    };

    const renderVariance=(variance)=>{
        const numeric=Number(variance)||0;
        const varianceClass=numeric<0 ? "is-negative" : "is-positive";
        return `<td class="sa-mtd-number ${varianceClass}">${homeMoney(numeric)}</td>`;
    };

    const dataRows=rows.map(row=>{
        const variance=Number(row.variance);
        return `
            <tr>
                <td class="sa-mtd-unit">${String(row.storeNo||"")}</td>
                <td>${String(row.storeName||"")}</td>
                <td class="sa-mtd-number">${homeMoney(row.mtdSales)}</td>
                <td class="sa-mtd-number">${Number(row.customer||0).toLocaleString("en-US")}</td>
                <td class="sa-mtd-number">${homeMoney(row.apsdSales)}</td>
                <td class="sa-mtd-number">${homeMoney(row.apsdBudget)}</td>
                ${renderVariance(variance)}
                <td>${renderStatus(variance)}</td>
            </tr>`;
    }).join("");

    const totalStatus=renderStatus(totalVariance);
    const avgStatus=renderStatus(avgVariance);

    body.innerHTML=dataRows + `
        <tr class="sa-mtd-summary sa-mtd-total-row">
            <td class="sa-mtd-unit">${storeCount} STORE${storeCount===1?"":"S"}</td>
            <td class="sa-mtd-summary-label">Total MTD</td>
            <td class="sa-mtd-number">${homeMoney(totalSales)}</td>
            <td class="sa-mtd-number">${totalCustomer.toLocaleString("en-US")}</td>
            <td class="sa-mtd-number">${homeMoney(totalApsdSales)}</td>
            <td class="sa-mtd-number">${homeMoney(totalApsdBudget)}</td>
            ${renderVariance(totalVariance)}
            <td>${totalStatus}</td>
        </tr>
        <tr class="sa-mtd-summary sa-mtd-avg-row">
            <td></td>
            <td class="sa-mtd-summary-label">Avg</td>
            <td class="sa-mtd-number">${homeMoney(avgSales)}</td>
            <td class="sa-mtd-number">${avgCustomer.toLocaleString("en-US",{maximumFractionDigits:0})}</td>
            <td class="sa-mtd-number">${homeMoney(avgApsdSales)}</td>
            <td class="sa-mtd-number">${homeMoney(avgApsdBudget)}</td>
            ${renderVariance(avgVariance)}
            <td>${avgStatus}</td>
        </tr>`;
}

async function homeLoadMtdStorePerformance(selectedDate, username, role){
    const section=document.getElementById("homeMtdStorePerformance");
    const body=document.getElementById("homeMtdStoreBody");
    if(section) section.style.display="none";
    if(body) body.innerHTML="";
    if(!selectedDate || !Array.isArray(homeSalesStores) || !homeSalesStores.length) return;

    const dates=homeMtdDates(selectedDate);
    if(!dates.length) return;

    const responses=await Promise.all(
        dates.map(date=>callDailySalesAPI("getDailySalesList",{username,role,date}))
    );

    const salesByStore=new Map();
    const customerByStore=new Map();
    responses.forEach(response=>{
        if(!response || !response.status || !Array.isArray(response.rows)) return;
        response.rows.forEach(row=>{
            const key=homeStoreKey(row.storeNo);
            if(!key) return;
            const sales=Number(String(row.totalMerchandiseSales ?? "").replace(/,/g,"")) || 0;
            const customer=Number(String(row.totalCustomer ?? "").replace(/,/g,"")) || 0;
            salesByStore.set(key,(salesByStore.get(key)||0)+sales);
            customerByStore.set(key,(customerByStore.get(key)||0)+customer);
        });
    });

    const monthStart=dates[0];
    const records=homeSalesStores.map(store=>{
        const key=homeStoreKey(store.storeNo);
        const mtdSales=salesByStore.get(key)||0;
        const customer=customerByStore.get(key)||0;
        const openingISO=homeParseDateISO(store.openingDate);
        const activeStart=(openingISO && openingISO > monthStart) ? openingISO : monthStart;
        const activeDays=homeCalendarDaysInclusive(activeStart,selectedDate) || dates.length;
        const apsdSales=activeDays>0 ? mtdSales/activeDays : 0;
        const apsdBudget=Number(String(store.budgetSales ?? "").replace(/,/g,"")) || 0;
        const variance=apsdSales-apsdBudget;
        return {storeNo:store.storeNo||"",storeName:store.storeName||"",mtdSales,customer,apsdSales,apsdBudget,variance,activeDays};
    });

    homeRenderMtdStorePerformance(records,selectedDate);
}

async function loadHomeSalesDashboard(dateOverride=""){

    const authenticatedUser = homeCurrentUser();

    if(!authenticatedUser || !authenticatedUser.username){
        homeSetLoading(false);
        return;
    }

    if(typeof callDailySalesAPI !== "function"){
        console.warn("Daily Sales API is not available.");
        homeSetLoading(false);
        return;
    }

    const user = homeCurrentUser();

    const username = user.username || "";
    const role = user.role || "";

    homeSalesDate =
        dateOverride ||
        homeSalesDate ||
        homeYesterdayISO();

    homeSetDashboardDate(homeSalesDate);
    homeSetGreeting();
    homeSetLoading(true);

    try{

        const previousWeekDate = homePreviousWeekISO(homeSalesDate);

        const currentWeekDates = homeWeeklyDates(homeSalesDate);
        const lastWeekEndDate = previousWeekDate;
        const lastWeekDates = homeWeeklyDates(lastWeekEndDate);

        const currentWeekRequests = currentWeekDates.map(date =>
            callDailySalesAPI(
                "getDailySalesList",
                {
                    username,
                    role,
                    date
                }
            )
        );

        const lastWeekRequests = lastWeekDates.map(date =>
            callDailySalesAPI(
                "getDailySalesList",
                {
                    username,
                    role,
                    date
                }
            )
        );

        const [storeResponse,listResponse,previousListResponse,currentWeekResponses,lastWeekResponses] = await Promise.all([

            callDailySalesAPI(
                "getDailySalesStores",
                {
                    username,
                    role
                }
            ),

            callDailySalesAPI(
                "getDailySalesList",
                {
                    username,
                    role,
                    date:homeSalesDate
                }
            ),

            callDailySalesAPI(
                "getDailySalesList",
                {
                    username,
                    role,
                    date:previousWeekDate
                }
            ),

            Promise.all(currentWeekRequests),
            Promise.all(lastWeekRequests)

        ]);

        if(!storeResponse || !storeResponse.status){
            throw new Error(
                storeResponse?.message ||
                "Unable to load store data."
            );
        }

        if(!listResponse || !listResponse.status){
            throw new Error(
                listResponse?.message ||
                "Unable to load Daily Sales."
            );
        }

        homeSalesStores =
            Array.isArray(storeResponse.stores)
                ? storeResponse.stores
                : [];

        const rows =
            Array.isArray(listResponse.rows)
                ? listResponse.rows
                : [];

        const totalStores = homeSalesStores.length;

        /*
         * ADDITIVE WEEKLY APSD COMPARISON
         * --------------------------------
         * Current period = selected date and the 6 days before it.
         * Previous period = the 7 days immediately before that.
         * APSD uses ALL stores as the denominator, even when some
         * stores have not submitted on one or more days.
         * Existing Week-on-Week comparison below remains unchanged.
         */
        const weeklyApsd =
            homeWeeklyApsdFromResponses(
                currentWeekResponses,
                totalStores
            );

        const lastWeeklyApsd =
            homeWeeklyApsdFromResponses(
                lastWeekResponses,
                totalStores
            );

        /*
         * One submitted store = one unique Store No.
         */
        const submittedSet = new Set(
            rows
                .map(r =>
                    String(r.storeNo || "")
                        .replace(/^#/,"")
                        .trim()
                )
                .filter(Boolean)
        );

        const submittedStores = submittedSet.size;

        const pendingStores =
            Math.max(totalStores - submittedStores,0);

        const totalRecord = rows.length;

        const merchandiseSales =
            rows.reduce(
                (sum,r) =>
                    sum +
                    (
                        Number(
                            String(
                                r.totalMerchandiseSales ?? ""
                            ).replace(/,/g,"")
                        ) || 0
                    ),
                0
            );

        const totalCustomer =
            rows.reduce(
                (sum,r) =>
                    sum +
                    (
                        Number(
                            String(
                                r.totalCustomer ?? ""
                            ).replace(/,/g,"")
                        ) || 0
                    ),
                0
            );

        /*
         * Week-on-week comparison uses the same selected date
         * against the date exactly 7 days earlier.
         * Existing KPI calculations remain unchanged.
         */
        const previousRows =
            previousListResponse?.status && Array.isArray(previousListResponse.rows)
                ? previousListResponse.rows
                : [];

        const previousMerchandiseSales =
            previousRows.reduce(
                (sum,r) =>
                    sum +
                    (
                        Number(
                            String(
                                r.totalMerchandiseSales ?? ""
                            ).replace(/,/g,"")
                        ) || 0
                    ),
                0
            );

        const previousCustomer =
            previousRows.reduce(
                (sum,r) =>
                    sum +
                    (
                        Number(
                            String(
                                r.totalCustomer ?? ""
                            ).replace(/,/g,"")
                        ) || 0
                    ),
                0
            );

        const previousApsdSales =
            totalStores
                ? previousMerchandiseSales / totalStores
                : 0;

        const previousApsdCustomer =
            totalStores
                ? previousCustomer / totalStores
                : 0;

        /*
         * Budget comes from the Area/store list.
         * It is calculated for ALL stores, not only submitted stores.
         */
        const totalBudget =
            homeSalesStores.reduce(
                (sum,s) =>
                    sum +
                    (
                        Number(
                            String(
                                s.budgetSales ?? ""
                            ).replace(/,/g,"")
                        ) || 0
                    ),
                0
            );

        const apsdSales =
            totalStores
                ? merchandiseSales / totalStores
                : 0;

        const apsdCustomer =
            totalStores
                ? totalCustomer / totalStores
                : 0;

        const apsdBudget =
            totalStores
                ? totalBudget / totalStores
                : 0;

        const budgetPerformance =
            apsdBudget > 0
                ? (apsdSales / apsdBudget) * 100
                : 0;

        const submissionPct =
            totalStores
                ? (submittedStores / totalStores) * 100
                : 0;

        /*
         * KPI CARDS
         */
        homeSetText(
            "homeTotalSales",
            homeMoney(merchandiseSales)
        );

        homeSetText(
            "homeApsdSales",
            homeMoney(apsdSales)
        );

        homeSetText(
            "homeTotalCustomer",
            homeNumber(totalCustomer)
        );

        homeSetText(
            "homeApsdCustomer",
            homeNumber(apsdCustomer)
        );

        /*
         * WEEK-ON-WEEK COMPARISON — visual/additive only.
         */
        homeSetText(
            "homeWowApsdSales",
            homeMoney(apsdSales)
        );

        homeSetText(
            "homeWowLastApsdSales",
            homeMoney(previousApsdSales)
        );

        homeSetText(
            "homeWowApsdCustomer",
            homeNumber(apsdCustomer)
        );

        homeSetText(
            "homeWowLastApsdCustomer",
            homeNumber(previousApsdCustomer)
        );

        homeSetWowChange(
            "homeWowSalesChange",
            apsdSales,
            previousApsdSales
        );

        homeSetWowChange(
            "homeWowCustomerChange",
            apsdCustomer,
            previousApsdCustomer
        );

        /*
         * ADDITIVE WEEKLY APSD COMPARISON
         * Do not replace/remove the existing Week-on-Week section.
         */
        homeSetText(
            "homeWeeklyApsdSales",
            homeMoney(weeklyApsd.sales)
        );

        homeSetText(
            "homeWeeklyLastApsdSales",
            homeMoney(lastWeeklyApsd.sales)
        );

        homeSetText(
            "homeWeeklyApsdCustomer",
            homeNumber(weeklyApsd.customer)
        );

        homeSetText(
            "homeWeeklyLastApsdCustomer",
            homeNumber(lastWeeklyApsd.customer)
        );

        homeSetWeeklyApsdChange(
            "homeWeeklyApsdSalesChange",
            weeklyApsd.sales,
            lastWeeklyApsd.sales
        );

        homeSetWeeklyApsdChange(
            "homeWeeklyApsdCustomerChange",
            weeklyApsd.customer,
            lastWeeklyApsd.customer
        );

        homeSetWeeklyApsdPeriod(
            "homeWeeklyApsdThisPeriod",
            currentWeekDates[0],
            currentWeekDates[6]
        );

        homeSetWeeklyApsdPeriod(
            "homeWeeklyApsdLastPeriod",
            lastWeekDates[0],
            lastWeekDates[6]
        );

        homeSetText(
            "homeSalesLabel",
            homeDisplayDate(homeSalesDate)
        );

        /*
         * STORE SUBMISSION
         */
        homeSetText(
            "homeSubmittedStores",
            homeNumber(submittedStores)
        );

        homeSetText(
            "homeTotalStores",
            homeNumber(totalStores)
        );

        homeSetText(
            "homeSubmittedLabel",
            homeNumber(submittedStores) + " SUBMITTED"
        );

        homeSetText(
            "homePendingStores",
            homeNumber(pendingStores) + " PENDING"
        );

        homeSetText(
            "homeSubmissionPct",
            Math.round(submissionPct) + "%"
        );

        /*
         * APSD BUDGET PERFORMANCE
         *
         * IMPORTANT:
         * The HTML uses separate IDs for Merchandise Sales
         * and Budget. Do not write into a removed/old
         * "homeBudgetValues" element.
         */
        homeSetText(
            "homeBudgetPct",
            homePercent(budgetPerformance)
        );

        homeSetText(
            "homeApsdBudgetActual",
            homeMoney(apsdSales)
        );

        homeSetText(
            "homeApsdBudgetTarget",
            homeMoney(apsdBudget)
        );

        homeSetText(
            "homeBudgetCaption",
            homePercent(budgetPerformance) +
            " of Budget Achieved"
        );

        /*
         * DONUT
         */
        const degrees =
            Math.min(
                Math.max(submissionPct,0),
                100
            ) * 3.6;

        const donut =
            document.getElementById(
                "homeSubmissionDonut"
            );

        if(donut){
            donut.style.background =
                "conic-gradient(" +
                "#C1121F 0deg " +
                degrees +
                "deg,#E5E7EB " +
                degrees +
                "deg 360deg)";
        }

        /*
         * BUDGET BAR
         */
        const budgetBar =
            document.getElementById(
                "homeBudgetBar"
            );

        if(budgetBar){
            budgetBar.style.width =
                Math.min(
                    Math.max(
                        budgetPerformance,
                        0
                    ),
                    100
                ) + "%";
        }

        // ADDITIVE ONLY: MTD store performance list.
        await homeLoadMtdStorePerformance(
            homeSalesDate,
            username,
            role
        );

    }catch(err){

        console.error(
            "Home Sales Dashboard:",
            err
        );

        if(typeof showError === "function"){
            showError(
                err?.message ||
                "Unable to load Sales Dashboard."
            );
        }

    }finally{

        homeSetLoading(false);

    }
}

function initHomeSalesDashboard(){

    /* DASHBOARD UI LOCK — native date picker remains enabled */
    const lockedDateInput =
        document.getElementById("homeSalesDate");

    if(lockedDateInput){
        lockedDateInput.disabled = false;
        lockedDateInput.readOnly = false;
    }


    /*
     * Never call Daily Sales API before authentication.
     */
    const user = homeCurrentUser();

    if(!user || !user.username){
        return;
    }

    if(homeSalesDashboardInitialized){

        const input =
            document.getElementById(
                "homeSalesDate"
            );

        loadHomeSalesDashboard(
            homeGetDashboardSelectedISO() ||
            homeSalesDate ||
            homeYesterdayISO()
        );

        return;
    }

    homeSalesDashboardInitialized = true;

    const input =
        document.getElementById(
            "homeSalesDate"
        );

    const refresh =
        document.getElementById(
            "homeRefreshSales"
        );

    if(input){

        homeSetDashboardDate(
            homeSalesDate ||
            homeYesterdayISO()
        );

        input.addEventListener(
            "input",
            ()=>{
                input.value =
                    String(input.value || "")
                        .replace(/[^0-9]/g,"")
                        .slice(0,8)
                        .replace(/(\d{2})(\d)/,"$1/$2")
                        .replace(/(\d{2})\/(\d{2})(\d)/,"$1/$2/$3");

                const iso =
                    homeDDMMYYYYToISO(input.value);

                if(iso){
                    homeSalesDate = iso;

                    loadHomeSalesDashboard(
                        iso
                    );
                }
            }
        );

        const picker =
            document.getElementById(
                "homeSalesDatePicker"
            );

        if(picker){

            picker.addEventListener(
                "change",
                ()=>{
                    const iso =
                        picker.value ||
                        homeYesterdayISO();

                    homeSalesDate = iso;

                    homeSetDashboardDate(
                        iso
                    );

                    loadHomeSalesDashboard(
                        iso
                    );
                }
            );

        }

        input.addEventListener(
            "click",
            homeOpenDashboardDatePicker
        );

    }

    if(refresh){

        refresh.addEventListener(
            "click",
            ()=>{
                const selectedDate =
                    homeGetDashboardSelectedISO();

                homeSalesDate = selectedDate;

                loadHomeSalesDashboard(
                    selectedDate
                );
            }
        );

    }

    homeResetDashboard();
    homeSetGreeting();

    /*
     * Delay one tick so Daily Sales API functions
     * are fully available.
     */
    setTimeout(
        ()=>{
            const selectedDate =
                homeGetDashboardSelectedISO();

            homeSalesDate = selectedDate;

            loadHomeSalesDashboard(
                selectedDate
            );
        },
        0
    );
}
