export const venCode = (id) => `VEN-${String(id).padStart(6, '0')}`

export const vendorRef = (vendor) => vendor?.vendor_code || venCode(vendor?.id)
