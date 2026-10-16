"use client";

import { startTransition, useActionState } from "react";
import { saveSettings } from "@/actions/admin/settings";
import { FormMessage } from "@/components/admin/ui";
import type { StoreSettings } from "@/lib/store-data";
import { centsToInput } from "@/lib/format";

function Text({ name, label, value, hint, area, placeholder }: { name: string; label: string; value: string; hint?: string; area?: boolean; placeholder?: string }) {
  return (
    <div>
      <label htmlFor={name} className="label">
        {label}
      </label>
      {area ? (
        <textarea id={name} name={name} defaultValue={value} rows={2} className="input" placeholder={placeholder} />
      ) : (
        <input id={name} name={name} defaultValue={value} className="input" placeholder={placeholder} />
      )}
      {hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
    </div>
  );
}

function Toggle({ name, label, hint, checked }: { name: string; label: string; hint?: string; checked: boolean }) {
  return (
    <label className="flex items-start gap-3">
      <input type="checkbox" name={name} defaultChecked={checked} className="mt-1 h-4 w-4 accent-brand-600" />
      <span>
        <span className="block text-sm font-bold">{label}</span>
        {hint && <span className="block text-xs text-stone-500">{hint}</span>}
      </span>
    </label>
  );
}

export function SettingsForm({ settings: s }: { settings: StoreSettings }) {
  const [state, action, pending] = useActionState(saveSettings, undefined);

  return (
    <form
      action={action}
      // Una vez hidratado, se envía manualmente para que React no limpie el formulario si el servidor regresa un error.
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => action(formData));
      }}
      className="grid items-start gap-6 lg:grid-cols-2"
    >
      <section className="card space-y-4 p-5">
        <h2 className="font-extrabold">Pedidos en línea</h2>
        <Toggle name="acceptingOrders" checked={s.acceptingOrders} label="Recibir pedidos en línea" hint="Apágalo si cierras temprano o no puedes atender pedidos. La tienda sigue visible." />
        <Toggle name="pickupEnabled" checked={s.pickupEnabled} label="Permitir recoger en tienda" />
        <Toggle name="deliveryEnabled" checked={s.deliveryEnabled} label="Permitir envío a domicilio" />
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="deliveryFee" className="label">Costo de envío ($)</label>
            <input id="deliveryFee" name="deliveryFee" inputMode="decimal" defaultValue={centsToInput(s.deliveryFee)} className="input" />
          </div>
          <div>
            <label htmlFor="freeDeliveryMin" className="label">Envío gratis desde ($)</label>
            <input id="freeDeliveryMin" name="freeDeliveryMin" inputMode="decimal" defaultValue={centsToInput(s.freeDeliveryMin)} className="input" />
            <p className="mt-1 text-xs text-stone-500">0 = nunca gratis</p>
          </div>
          <div>
            <label htmlFor="minOrder" className="label">Pedido mínimo ($)</label>
            <input id="minOrder" name="minOrder" inputMode="decimal" defaultValue={centsToInput(s.minOrder)} className="input" />
          </div>
        </div>
        <Text name="deliveryArea" label="Zona de entrega" value={s.deliveryArea} />
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-extrabold">Portada</h2>
        <Text name="announcement" label="Aviso en la barra superior" value={s.announcement} hint="Déjalo vacío para no mostrar aviso." placeholder="Ej. 🎉 Martes de frutas y verduras" />
        <Text name="heroTitle" label="Título principal" value={s.heroTitle} />
        <Text name="heroSubtitle" label="Texto bajo el título" value={s.heroSubtitle} area />
      </section>

      <section className="card space-y-4 p-5 lg:col-span-2">
        <div>
          <h2 className="font-extrabold">🇺🇸 Textos en inglés</h2>
          <p className="text-sm text-stone-500">Lo que dejes vacío se traduce automáticamente con IA al guardar.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Text name="announcementEn" label="Aviso en la barra superior" value={s.announcementEn} />
          <Text name="taglineEn" label="Lema" value={s.taglineEn} />
          <Text name="heroTitleEn" label="Título principal" value={s.heroTitleEn} />
          <Text name="heroSubtitleEn" label="Texto bajo el título" value={s.heroSubtitleEn} area />
          <Text name="hoursEn" label="Horario" value={s.hoursEn} />
          <Text name="deliveryAreaEn" label="Zona de entrega" value={s.deliveryAreaEn} />
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-extrabold">Datos de la tienda</h2>
        <Text name="storeName" label="Nombre" value={s.storeName} />
        <Text name="tagline" label="Lema" value={s.tagline} />
        <Text name="address" label="Dirección" value={s.address} />
        <Text name="hours" label="Horario" value={s.hours} />
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-extrabold">Contacto</h2>
        <Text name="phone" label="Teléfono" value={s.phone} />
        <Text name="whatsapp" label="WhatsApp" value={s.whatsapp} hint="Solo números con lada de país. México: 521 + 10 dígitos." placeholder="5215512345678" />
        <Text name="email" label="Correo" value={s.email} />
      </section>

      <section className="card space-y-4 p-5 lg:col-span-2">
        <div>
          <h2 className="font-extrabold">🏦 Pago por transferencia</h2>
          <p className="text-sm text-stone-500">
            Se le muestran al cliente cuando elige pagar con transferencia (en el checkout, en su pedido y en WhatsApp). Deja vacío lo que no uses.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Text name="bankName" label="Banco" value={s.bankName} placeholder="Ej. BBVA" />
          <Text name="bankAccountHolder" label="Titular" value={s.bankAccountHolder} placeholder="Nombre como aparece en la cuenta" />
          <Text name="bankAccount" label="Número de cuenta" value={s.bankAccount} />
          <Text name="bankClabe" label="CLABE interbancaria" value={s.bankClabe} hint="18 dígitos, para transferencias desde otros bancos." />
          <Text name="bankCard" label="Tarjeta de débito" value={s.bankCard} hint="16 dígitos, para depósitos en OXXO o transferencias a tarjeta." />
          <Text name="bankNote" label="Indicación para el cliente (opcional)" value={s.bankNote} placeholder="Ej. Manda tu comprobante por WhatsApp con tu número de pedido." />
        </div>
      </section>

      <section className="card space-y-4 p-5 lg:col-span-2">
        <h2 className="font-extrabold">💬 WhatsApp</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Toggle name="botEnabled" checked={s.botEnabled} label="Bot que toma pedidos" hint="Contesta a los clientes, arma el pedido y lo registra." />
          <Toggle name="notifyCustomers" checked={s.notifyCustomers} label="Avisar a clientes" hint="Mensaje automático cuando su pedido cambia de estado." />
          <Toggle name="notifyStore" checked={s.notifyStore} label="Avisar a la tienda" hint="Mensaje al número de abajo con cada pedido nuevo." />
        </div>
        <Text name="storeNotifyPhone" label="WhatsApp que recibe los avisos de pedidos nuevos" value={s.storeNotifyPhone} placeholder="55 1234 5678" />
        <Text
          name="botInstructions"
          label="Indicaciones extra para el bot"
          value={s.botInstructions}
          area
          placeholder="Ej. Los martes hay 10% en frutas y verduras. No vendemos cigarros. Los garrafones solo se entregan en la mañana."
          hint="Promociones, avisos o reglas que el bot debe tomar en cuenta al platicar con los clientes."
        />
      </section>

      <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
        <button type="submit" disabled={pending} className="btn btn-primary px-8">
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
