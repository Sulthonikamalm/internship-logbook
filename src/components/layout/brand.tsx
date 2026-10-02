import Image from "next/image";
import Link from "next/link";

export function Brand() {
  return <Link href="/dashboard" aria-label="InternFlow Home" className="flex h-12 items-center">
    <Image src="/internflow-logo.png" alt="InternFlow" width={170} height={57} preload className="h-auto w-[155px]" />
  </Link>;
}
