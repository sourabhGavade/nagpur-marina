"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "toast",
          title: "toast-title",
          description: "toast-description",
          error: "toast-error",
          success: "toast-success",
        },
      }}
      {...props}
    />
  );
}
