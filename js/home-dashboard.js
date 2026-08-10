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

function homeMoney(value){
    const n = Number(String(value ?? "").replace(/,/g,"")) || 0;

    return "RM " + n.toLocaleString("en-MY",{
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

    if(input){
        input.value = date;
    }
}

function homeResetDashboard(){
    const values = {
        homeTotalSales:"RM 0.00",
        homeApsdSales:"RM 0.00",
        homeTotalCustomer:"0",
        homeApsdCustomer:"0",

        homeSubmittedStores:"0",
        homeTotalStores:"0",
        homeSubmittedLabel:"0 SUBMITTED",
        homePendingStores:"0 PENDING",
        homeSubmissionPct:"0%",

        homeBudgetPct:"0.00%",
        homeApsdBudgetActual:"RM 0.00",
        homeApsdBudgetTarget:"RM 0.00",
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

        const [storeResponse,listResponse] = await Promise.all([

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
            )

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
            input?.value ||
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

        input.value =
            homeSalesDate ||
            homeYesterdayISO();

        input.addEventListener(
            "change",
            ()=>{
                homeSalesDate = input.value;

                loadHomeSalesDashboard(
                    homeSalesDate
                );
            }
        );

    }

    if(refresh){

        refresh.addEventListener(
            "click",
            ()=>{
                const selectedDate =
                    document.getElementById(
                        "homeSalesDate"
                    )?.value ||
                    homeYesterdayISO();

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
                input?.value ||
                homeYesterdayISO();

            homeSalesDate = selectedDate;

            loadHomeSalesDashboard(
                selectedDate
            );
        },
        0
    );
}
