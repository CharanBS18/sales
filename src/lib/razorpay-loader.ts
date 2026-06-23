// Lazy-loads the Razorpay Checkout script and returns the global constructor.
declare global {
  interface Window {
    Razorpay?: any;
  }
}

let loaderPromise: Promise<any> | null = null;

export function loadRazorpay(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Razorpay can only load in the browser"));
  }
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => {
      if (window.Razorpay) resolve(window.Razorpay);
      else reject(new Error("Razorpay failed to load"));
    };
    s.onerror = () => reject(new Error("Razorpay script failed to load"));
    document.head.appendChild(s);
  });
  return loaderPromise;
}
