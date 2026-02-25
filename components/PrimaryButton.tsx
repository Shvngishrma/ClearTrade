import Link from "next/link"
import clsx from "clsx"
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react"

type BaseProps = {
  children: ReactNode
  className?: string
  fullWidth?: boolean
}

type ButtonProps = BaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: undefined
  }

type LinkProps = BaseProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "href"> & {
    href: string
    disabled?: boolean
  }

type PrimaryButtonProps = ButtonProps | LinkProps

const baseClassName =
  "inline-flex items-center justify-center px-6 py-3 rounded-xl font-medium shadow-sm " +
  "bg-gray-200 text-gray-900 dark:bg-zinc-800 dark:text-zinc-100 " +
  "hover:bg-gray-300 dark:hover:bg-zinc-700 " +
  "transition-all duration-200 active:scale-95 " +
  "disabled:opacity-50 disabled:cursor-not-allowed"

export default function PrimaryButton(props: PrimaryButtonProps) {
  const { children, className, fullWidth = false } = props
  const classes = clsx(baseClassName, fullWidth && "w-full", className)

  if ("href" in props && props.href) {
    const { href, disabled, ...linkProps } = props

    if (disabled) {
      return (
        <span className={clsx(classes, "pointer-events-none")} aria-disabled="true">
          {children}
        </span>
      )
    }

    return (
      <Link href={href} className={classes} {...linkProps}>
        {children}
      </Link>
    )
  }

  const { type = "button", ...buttonProps } = props as ButtonProps

  const buttonType: "button" | "submit" | "reset" =
    type === "submit" || type === "reset" ? type : "button"

  return (
    <button type={buttonType} className={classes} {...buttonProps}>
      {children}
    </button>
  )
}