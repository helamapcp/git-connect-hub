/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import BagInventory from './pages/BagInventory';
import BagTransfer from './pages/BagTransfer';
import CamposProduto from './pages/CamposProduto';
import ConsumptionHistory from './pages/ConsumptionHistory';
import Dashboard from './pages/Dashboard';
import Estoque from './pages/Estoque';
import FactoryDashboard from './pages/FactoryDashboard';
import MachineConsumption from './pages/MachineConsumption';
import MachineSelection from './pages/MachineSelection';
import Orders from './pages/Orders';
import PlanejamentoComposto from './pages/PlanejamentoComposto';
import Production from './pages/Production';
import Produtos from './pages/Produtos';
import Settings from './pages/Settings';
import __Layout from './Layout.jsx';


export const PAGES = {
    "BagInventory": BagInventory,
    "BagTransfer": BagTransfer,
    "CamposProduto": CamposProduto,
    "ConsumptionHistory": ConsumptionHistory,
    "Dashboard": Dashboard,
    "Estoque": Estoque,
    "FactoryDashboard": FactoryDashboard,
    "MachineConsumption": MachineConsumption,
    "MachineSelection": MachineSelection,
    "Orders": Orders,
    "PlanejamentoComposto": PlanejamentoComposto,
    "Production": Production,
    "Produtos": Produtos,
    "Settings": Settings,
}

export const pagesConfig = {
    mainPage: "MachineSelection",
    Pages: PAGES,
    Layout: __Layout,
};