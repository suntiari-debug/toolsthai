import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import ComingSoon from "./pages/ComingSoon";
import CalculatorTool from "./pages/CalculatorTool";
import Account from "./pages/Account";
import DocumentCenter from "./pages/DocumentCenter";
import DocumentTool from "./pages/DocumentTool";
import Home from "./pages/Home";
import ToolDirectory from "./pages/ToolDirectory";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/tools" component={ToolDirectory} />
      <Route path="/account" component={Account} />
      <Route path="/documents" component={DocumentCenter} />
      <Route path="/quotation">{() => <DocumentTool kind="quotation" />}</Route>
      <Route path="/invoice">{() => <DocumentTool kind="invoice" />}</Route>
      <Route path="/receipt">{() => <DocumentTool kind="receipt" />}</Route>
      <Route path="/delivery-note">{() => <DocumentTool kind="delivery-note" />}</Route>
      <Route path="/tax-invoice">{() => <DocumentTool kind="tax-invoice" />}</Route>
      <Route path="/pricing-calculator">{() => <CalculatorTool kind="pricing" />}</Route>
      <Route path="/vat-calculator">{() => <CalculatorTool kind="vat" />}</Route>
      <Route path="/margin-calculator">{() => <CalculatorTool kind="margin" />}</Route>
      <Route path="/payment-terms">{() => <CalculatorTool kind="payment-terms" />}</Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
