import path from "node:path";
import { Document, Page, View, Text, Image, Font, StyleSheet } from "@react-pdf/renderer";

// Registered once per process from the same subset font bundled for the
// server-side personalization renderer (public/fonts) — a local file path
// is more reliable in a serverless runtime than fetching a font over the
// network on every request.
let fontRegistered = false;
function ensureFont() {
  if (fontRegistered) return;
  Font.register({
    family: "Cormorant Garamond",
    src: path.join(process.cwd(), "public", "fonts", "CormorantGaramond-Subset.ttf"),
  });
  fontRegistered = true;
}

export type ImageAsset = { data: Buffer; format: "png" | "jpg" };

export type ReceiptItem = {
  productName: string;
  variantLabel: string | null;
  thumbnail: ImageAsset | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  personalizationSummary: string | null;
};

export type ReceiptData = {
  orderId: string;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  shippingAddress: {
    address: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  planner: {
    businessName: string;
    tagline: string | null;
    logo: ImageAsset | null;
    accentColor: string;
  };
  items: ReceiptItem[];
  subtotal: number;
  personalizationFee: number;
  sampleFee: number;
  shippingFee: number;
  tax: number;
  total: number;
  deliveryEstimate: string | null;
};

const money = (n: number) => `$${n.toFixed(2)}`;

function styles(accent: string) {
  return StyleSheet.create({
    page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: "#2a2622" },
    headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 },
    logo: { width: 40, height: 40, borderRadius: 20, objectFit: "cover" },
    businessName: { fontFamily: "Cormorant Garamond", fontSize: 20, marginBottom: 2 },
    tagline: { fontSize: 8, color: "#7a746b", textTransform: "uppercase", letterSpacing: 1 },
    receiptTitle: { fontFamily: "Cormorant Garamond", fontSize: 22, textAlign: "right", color: accent },
    metaText: { fontSize: 9, color: "#7a746b", textAlign: "right", marginTop: 2 },
    divider: { borderBottomWidth: 1, borderBottomColor: accent, marginBottom: 16 },
    sectionTitle: { fontSize: 8, textTransform: "uppercase", letterSpacing: 1, color: "#7a746b", marginBottom: 4 },
    addressBlock: { marginBottom: 20 },
    addressText: { fontSize: 10, lineHeight: 1.5 },
    tableHeaderRow: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: "#e4dccf",
      paddingBottom: 6,
      marginBottom: 8,
    },
    tableHeaderCell: { fontSize: 8, textTransform: "uppercase", letterSpacing: 0.5, color: "#7a746b" },
    itemRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: "#efeae3",
    },
    itemThumb: { width: 34, height: 34, borderRadius: 4, objectFit: "cover", marginRight: 8 },
    itemThumbPlaceholder: { width: 34, height: 34, borderRadius: 4, backgroundColor: "#efeae3", marginRight: 8 },
    itemName: { fontSize: 10, fontWeight: 700 },
    itemDetail: { fontSize: 8, color: "#7a746b", marginTop: 2 },
    colProduct: { flexGrow: 1, flexDirection: "row", alignItems: "center" },
    colQty: { width: 40, textAlign: "center" },
    colPrice: { width: 60, textAlign: "right" },
    colTotal: { width: 60, textAlign: "right" },
    summaryBlock: { alignSelf: "flex-end", width: 220, marginTop: 16 },
    summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
    summaryLabel: { fontSize: 9, color: "#7a746b" },
    summaryValue: { fontSize: 9 },
    totalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 6,
      paddingTop: 6,
      borderTopWidth: 1,
      borderTopColor: "#2a2622",
    },
    totalLabel: { fontSize: 11, fontFamily: "Cormorant Garamond" },
    totalValue: { fontSize: 13, fontFamily: "Cormorant Garamond", color: accent },
    delivery: {
      marginTop: 24,
      padding: 12,
      backgroundColor: "#efeae3",
      borderRadius: 6,
    },
    deliveryLabel: { fontSize: 8, textTransform: "uppercase", letterSpacing: 1, color: "#7a746b", marginBottom: 2 },
    deliveryValue: { fontSize: 11, fontFamily: "Cormorant Garamond" },
    footer: { marginTop: 30, textAlign: "center", color: "#7a746b", fontSize: 9 },
  });
}

export function OrderReceiptDocument({ data }: { data: ReceiptData }) {
  ensureFont();
  const s = styles(data.planner.accentColor);
  const orderDate = new Date(data.createdAt).toLocaleDateString(undefined, {
    dateStyle: "long",
  });

  return (
    <Document title={`Receipt — ${data.orderId.slice(0, 8).toUpperCase()}`}>
      <Page size="A4" style={s.page}>
        <View style={s.headerRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image is a PDF node, not an <img> */}
            {data.planner.logo && <Image src={data.planner.logo} style={s.logo} />}
            <View>
              <Text style={s.businessName}>{data.planner.businessName}</Text>
              {data.planner.tagline && <Text style={s.tagline}>{data.planner.tagline}</Text>}
            </View>
          </View>
          <View>
            <Text style={s.receiptTitle}>Order Receipt</Text>
            <Text style={s.metaText}>Ref {data.orderId.slice(0, 8).toUpperCase()}</Text>
            <Text style={s.metaText}>{orderDate}</Text>
          </View>
        </View>
        <View style={s.divider} />

        <View style={s.addressBlock}>
          <Text style={s.sectionTitle}>Billed to</Text>
          <Text style={s.addressText}>{data.customerName}</Text>
          <Text style={s.addressText}>{data.customerEmail}</Text>
          <Text style={s.addressText}>
            {data.shippingAddress.address}, {data.shippingAddress.city}, {data.shippingAddress.state}{" "}
            {data.shippingAddress.zip}, {data.shippingAddress.country}
          </Text>
        </View>

        <View style={s.tableHeaderRow}>
          <Text style={[s.tableHeaderCell, { flexGrow: 1 }]}>Item</Text>
          <Text style={[s.tableHeaderCell, s.colQty]}>Qty</Text>
          <Text style={[s.tableHeaderCell, s.colPrice]}>Unit</Text>
          <Text style={[s.tableHeaderCell, s.colTotal]}>Total</Text>
        </View>

        {data.items.map((item, i) => (
          <View key={i} style={s.itemRow} wrap={false}>
            <View style={s.colProduct}>
              {item.thumbnail ? (
                // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image is a PDF node, not an <img>
                <Image src={item.thumbnail} style={s.itemThumb} />
              ) : (
                <View style={s.itemThumbPlaceholder} />
              )}
              <View>
                <Text style={s.itemName}>
                  {item.productName}
                  {item.variantLabel ? ` — ${item.variantLabel}` : ""}
                </Text>
                {item.personalizationSummary && <Text style={s.itemDetail}>{item.personalizationSummary}</Text>}
              </View>
            </View>
            <Text style={s.colQty}>{item.quantity}</Text>
            <Text style={s.colPrice}>{money(item.unitPrice)}</Text>
            <Text style={s.colTotal}>{money(item.lineTotal)}</Text>
          </View>
        ))}

        <View style={s.summaryBlock}>
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>Subtotal</Text>
            <Text style={s.summaryValue}>{money(data.subtotal)}</Text>
          </View>
          {data.personalizationFee > 0 && (
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>Personalization</Text>
              <Text style={s.summaryValue}>{money(data.personalizationFee)}</Text>
            </View>
          )}
          {data.sampleFee > 0 && (
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>Sample setup</Text>
              <Text style={s.summaryValue}>{money(data.sampleFee)}</Text>
            </View>
          )}
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>Shipping</Text>
            <Text style={s.summaryValue}>{data.shippingFee === 0 ? "Free" : money(data.shippingFee)}</Text>
          </View>
          {data.tax > 0 && (
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>Tax</Text>
              <Text style={s.summaryValue}>{money(data.tax)}</Text>
            </View>
          )}
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Total</Text>
            <Text style={s.totalValue}>{money(data.total)}</Text>
          </View>
        </View>

        {data.deliveryEstimate && (
          <View style={s.delivery}>
            <Text style={s.deliveryLabel}>Estimated delivery</Text>
            <Text style={s.deliveryValue}>{data.deliveryEstimate}</Text>
          </View>
        )}

        <Text style={s.footer}>
          Thank you for celebrating with {data.planner.businessName}. Every piece is proofed by hand before it goes
          to print.
        </Text>
      </Page>
    </Document>
  );
}
