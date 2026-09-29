interface TestOrder {
  readonly id: string
  readonly customer: string
  readonly product: string
  readonly value: string
  readonly status: string
  readonly detail: string
  readonly question: string
}

const orders: readonly TestOrder[] = [
  {
    id: 'ORD-101', customer: 'Priya Sharma', product: 'Vitamin C Serum (30ml)', value: '₹699',
    status: 'Out for Delivery', detail: 'BlueDart · BD-982103 · Expected by 6 PM today',
    question: 'Where is my order ORD-101?',
  },
  {
    id: 'ORD-102', customer: 'Rahul Verma', product: 'Hydrating Sunscreen SPF 50', value: '₹499',
    status: 'Delivered', detail: 'Delhivery · DL-441029 · Delivered 14 days ago',
    question: 'Can I return order ORD-102?',
  },
  {
    id: 'ORD-103', customer: 'Ananya Patel', product: 'Green Tea Face Wash + Toner', value: '₹850',
    status: 'Processing', detail: 'Ordered 3 hours ago · Eligible for cancellation',
    question: 'Can I cancel ORD-103?',
  },
]

export function TestOrders({ onSelect, disabled = false }: { readonly onSelect: (question: string) => void; readonly disabled?: boolean }) {
  return (
    <section className="panel orders-panel">
      <div className="section-heading">
        <div><p className="eyebrow">QUICK REFERENCE</p><h2>Test orders</h2></div>
        <span className="count-badge">3</span>
      </div>
      <p className="panel-help">Select an order to add a sample question to the composer.</p>
      <div className="order-list">
        {orders.map((order) => (
          <article className="order-card" key={order.id}>
            <div className="order-topline">
              <button type="button" className="order-id" disabled={disabled} onClick={() => onSelect(order.question)} aria-label={`Use a sample question for ${order.id}`}>
                {order.id} <span aria-hidden="true">↗</span>
              </button>
              <span className="order-value">{order.value}</span>
            </div>
            <p className="order-customer">{order.customer}</p>
            <p className="order-product">{order.product}</p>
            <span className={`order-status order-status-${order.status.toLowerCase().replaceAll(' ', '-')}`}>{order.status}</span>
            <p className="order-detail">{order.detail}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
