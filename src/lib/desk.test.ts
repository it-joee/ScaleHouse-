import assert from "node:assert/strict";
import test from "node:test";
import {
  canBrief,
  contractBooks,
  houseContract,
  morningBrief,
  normSupplier,
  supplierLedger,
  tonnesLeft,
  whatsAppHref,
  type Company,
  type Contract,
  type Delivery,
} from "./domain.ts";
import { parseSpokenTicket } from "./speech-intake.ts";

function delivery(patch: Partial<Delivery> & Pick<Delivery, "id" | "companyId" | "supplierName">): Delivery {
  return {
    loggedOn: "2026-10-01",
    waybill: "",
    truckNumber: "TG 1",
    truckNorm: "TG1",
    commodityId: "shea",
    declaredMt: 50,
    sgsMt: 50,
    contractQtyMt: null,
    contractBalMt: null,
    grossKg: null,
    tareKg: null,
    moisturePct: null,
    brokenSeal: false,
    damagedBags: 0,
    qcNote: "",
    driverName: "",
    driverContact: "",
    origin: "Togo",
    supplierContact: "",
    warehouse: "",
    deliveredOn: null,
    status: "offloaded",
    offloadedOn: "2026-10-02",
    comment: "",
    officer: "",
    purchasePriceMt: null,
    marketHubId: null,
    photoUrl: "",
    createdBy: "",
    createdAt: "2026-10-01T00:00:00.000Z",
    modifiedBy: "",
    modifiedAt: "2026-10-01T00:00:00.000Z",
    ...patch,
  };
}

function contract(patch: Partial<Contract> & Pick<Contract, "id" | "companyId" | "supplierName" | "tonnes" | "signedOn">): Contract {
  return {
    commodityId: "shea",
    pricePerMt: null,
    note: "",
    createdBy: "Ada",
    createdAt: "2026-10-01T00:00:00.000Z",
    ...patch,
  };
}

const jni: Company = { id: "jni", name: "JNI AGRI LTD", code: "JNI", active: true, sortOrder: 1 };

test("whatsapp deck is executives and admins only", () => {
  assert.equal(canBrief("admin"), true);
  assert.equal(canBrief("executive"), true);
  assert.equal(canBrief("floor"), false);
  assert.equal(canBrief("procurement"), false);
  assert.equal(whatsAppHref("0240000000", "yard"), "https://wa.me/233240000000?text=yard");
});

test("a new contract updates the house position without taking older loads", () => {
  const older = delivery({ id: "a", companyId: "jni", supplierName: "fadila", loggedOn: "2026-09-01", declaredMt: 40, sgsMt: 40 });
  const newer = delivery({ id: "b", companyId: "jni", supplierName: "Hajia Fadila", loggedOn: "2026-10-06", declaredMt: 50, sgsMt: null, status: "pending", offloadedOn: null });
  const first = contract({ id: "c1", companyId: "jni", supplierName: "Hajia Fadila", tonnes: 100, signedOn: "2026-08-01" });
  const second = contract({ id: "c2", companyId: "jni", supplierName: "Fadila", tonnes: 200, signedOn: "2026-10-01", createdAt: "2026-10-01T08:00:00.000Z" });
  const books = contractBooks([first, second], [older, newer]);
  const early = books.find((book) => book.contract.id === "c1");
  const late = books.find((book) => book.contract.id === "c2");
  assert.equal(early?.received, 40);
  assert.equal(early?.stillToCome, 60);
  assert.equal(late?.inYard, 50);
  assert.equal(late?.stillToCome, 150);
  const standing = houseContract("jni", books);
  assert.equal(standing.promised, 300);
  assert.equal(standing.stillToCome, 210);
  const brief = morningBrief({
    on: "13 Oct 2026",
    companies: [jni],
    deliveries: [older, newer],
    movements: [],
    contracts: [first, second],
    openCount: 0,
  });
  assert.match(brief, /Contracts still to come/);
  assert.match(brief, /JNI: 210.00 MT to come of 300.00 MT/);
});

test("supplier ledger folds honorifics and spoken intake fills a ticket", () => {
  assert.equal(normSupplier("Hajia Fadila"), normSupplier("fadila"));
  const lines = supplierLedger([
    delivery({ id: "a", companyId: "jni", supplierName: "Hajia Fadila" }),
    delivery({ id: "b", companyId: "frontier", supplierName: "fadila", brokenSeal: true }),
  ]);
  assert.equal(lines.length, 1);
  assert.equal(lines[0]?.trucks, 2);
  assert.equal(lines[0]?.claims, 1);
  const spoken = parseSpokenTicket("camion TG 8086 BH, cinquante virgule cinq tonnes, fournisseur Hajia Fadila, origine Togo");
  assert.equal(spoken.truckNumber, "TG 8086 BH");
  assert.equal(spoken.declaredMt, "50.5");
  assert.equal(spoken.supplierName, "Hajia Fadila");
  assert.equal(spoken.origin, "Togo");
  assert.equal(tonnesLeft(-3), "3.00 MT over");
});
