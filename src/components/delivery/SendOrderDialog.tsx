import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DeliveryOrder, DeliveryOrderItem, Supplier } from '@/types/delivery';
import { Mail, Phone, Globe, Printer, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface SendOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: DeliveryOrder;
  supplier: Supplier;
  items: DeliveryOrderItem[];
  onSent: () => void;
}

export const SendOrderDialog: React.FC<SendOrderDialogProps> = ({
  open,
  onOpenChange,
  order,
  supplier,
  items,
  onSent
}) => {
  const handleMarkAsSent = () => {
    onSent();
    onOpenChange(false);
  };

  const generateOrderText = () => {
    let text = `Order #${order.order_number}\n`;
    text += `Date: ${new Date(order.order_date).toLocaleDateString('en-GB')}\n`;
    if (order.expected_delivery_date) {
      text += `Expected Delivery: ${new Date(order.expected_delivery_date).toLocaleDateString('en-GB')}\n`;
    }
    text += `\nItems:\n`;
    items.forEach(item => {
      text += `- ${item.ingredient_name}: ${item.ordered_quantity} units @ £${(item.unit_cost || 0).toFixed(2)} = £${(item.total_cost || 0).toFixed(2)}\n`;
    });
    text += `\nTotal: £${(order.total_cost || 0).toFixed(2)}`;
    return text;
  };

  const handleCopyOrder = () => {
    navigator.clipboard.writeText(generateOrderText());
    toast.success('Order details copied to clipboard');
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>Order #${order.order_number}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { font-size: 24px; margin-bottom: 10px; }
            .header { margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #f5f5f5; }
            .total { margin-top: 20px; font-size: 18px; font-weight: bold; text-align: right; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Purchase Order</h1>
            <p><strong>Order #:</strong> ${order.order_number}</p>
            <p><strong>Date:</strong> ${new Date(order.order_date).toLocaleDateString('en-GB')}</p>
            <p><strong>Supplier:</strong> ${supplier.name}</p>
            ${order.expected_delivery_date ? `<p><strong>Expected Delivery:</strong> ${new Date(order.expected_delivery_date).toLocaleDateString('en-GB')}</p>` : ''}
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(item => `
                <tr>
                  <td>${item.ingredient_name}</td>
                  <td>${item.ordered_quantity} units</td>
                  <td>£${(item.unit_cost || 0).toFixed(2)}</td>
                  <td>£${(item.total_cost || 0).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="total">
            Total: £${(order.total_cost || 0).toFixed(2)}
          </div>
          
          <script>
            window.onload = function() {
              window.print();
              window.close();
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const renderContactMethod = () => {
    switch (supplier.order_method) {
      case 'email':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-5 w-5" />
              <span>Email: {supplier.email || 'Not provided'}</span>
            </div>
            {supplier.email && (
              <a
                href={`mailto:${supplier.email}?subject=Order ${order.order_number}&body=${encodeURIComponent(generateOrderText())}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" className="w-full">
                  <Mail className="h-4 w-4 mr-2" />
                  Open in Email Client
                </Button>
              </a>
            )}
            <Button variant="outline" onClick={handleCopyOrder} className="w-full">
              <Copy className="h-4 w-4 mr-2" />
              Copy Order Details
            </Button>
          </div>
        );

      case 'phone':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-5 w-5" />
              <span>Phone: {supplier.phone || 'Not provided'}</span>
            </div>
            {supplier.phone && (
              <a href={`tel:${supplier.phone}`}>
                <Button variant="outline" className="w-full">
                  <Phone className="h-4 w-4 mr-2" />
                  Call Supplier
                </Button>
              </a>
            )}
            <Button variant="outline" onClick={handleCopyOrder} className="w-full">
              <Copy className="h-4 w-4 mr-2" />
              Copy Order Details
            </Button>
          </div>
        );

      case 'online':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Globe className="h-5 w-5" />
              <span>Online Portal</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {supplier.notes || 'Please log into the supplier\'s online portal to place this order.'}
            </p>
            <Button variant="outline" onClick={handleCopyOrder} className="w-full">
              <Copy className="h-4 w-4 mr-2" />
              Copy Order Details
            </Button>
          </div>
        );

      case 'print':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Printer className="h-5 w-5" />
              <span>Print Order Form</span>
            </div>
            <Button variant="outline" onClick={handlePrint} className="w-full">
              <Printer className="h-4 w-4 mr-2" />
              Print Order
            </Button>
            <Button variant="outline" onClick={handleCopyOrder} className="w-full">
              <Copy className="h-4 w-4 mr-2" />
              Copy Order Details
            </Button>
          </div>
        );

      default:
        return (
          <Button variant="outline" onClick={handleCopyOrder} className="w-full">
            <Copy className="h-4 w-4 mr-2" />
            Copy Order Details
          </Button>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send Order to {supplier.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm font-medium mb-1">Order #{order.order_number}</p>
            <p className="text-2xl font-bold">£{(order.total_cost || 0).toFixed(2)}</p>
            <p className="text-sm text-muted-foreground mt-1">{items.length} items</p>
          </div>

          {renderContactMethod()}

          <div className="bg-amber-50 border border-amber-200 p-3 rounded">
            <p className="text-sm text-amber-800">
              ⚠️ After sending this order to the supplier, click "Mark as Sent" below to update the status.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleMarkAsSent}>
            Mark as Sent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};