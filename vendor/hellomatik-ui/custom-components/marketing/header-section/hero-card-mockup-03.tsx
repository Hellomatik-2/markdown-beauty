"use client";

import Image from "next/image";
import { ArrowRight, PlayCircle } from "@hm/icons";
import { BadgeGroup } from "@/components/base/badges/badge-groups";
import { Button } from "@/components/base/buttons/button";
import { Header } from "@/components/marketing/header-navigation/header";
import { CreditCard } from "@/components/shared-assets/credit-card/credit-card";

export const HeroCardMockup03 = () => {
    return (
        <div className="relative overflow-hidden bg-primary">
            {/* Background pattern */}
            <Image
                alt="Grid of dots"
                aria-hidden="true"
                loading="lazy"
                src="https://assets.local/patterns/light/grid-sm-desktop.svg"
                width={1440}
                height={800}
                unoptimized
                className="pointer-events-none absolute -top-2 left-1/2 z-0 hidden max-w-none -translate-x-1/2 md:block dark:brightness-[0.2]"
            />
            <Image
                alt="Grid of dots"
                aria-hidden="true"
                loading="lazy"
                src="https://assets.local/patterns/light/grid-sm-mobile.svg"
                width={768}
                height={600}
                unoptimized
                className="pointer-events-none absolute top-0 left-1/2 z-0 max-w-none -translate-x-1/2 md:hidden dark:brightness-[0.2]"
            />

            <Header />

            <section className="relative overflow-hidden pt-16 md:pt-24 md:pb-0">
                <div className="mx-auto w-full max-w-container px-4 md:px-8">
                    <div className="mx-auto flex max-w-5xl flex-col md:items-center md:text-center">
                        <a href="#" className="rounded-[10px] outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2">
                            <BadgeGroup className="hidden md:flex" size="lg" addonText="What's new?" iconTrailing={ArrowRight} theme="modern" color="brand">
                                Instantly issue virtual cards
                            </BadgeGroup>
                            <BadgeGroup className="md:hidden" size="md" addonText="What's new?" iconTrailing={ArrowRight} theme="modern" color="brand">
                                Instantly issue virtual cards
                            </BadgeGroup>
                        </a>

                        <h1 className="mt-4 text-display-md font-semibold text-primary md:text-display-lg lg:text-display-xl">No more banking headaches</h1>
                        <p className="mt-4 max-w-3xl text-lg text-balance text-tertiary md:mt-6 md:text-xl">
                            Mo money, no problems. Acme is a next-generation financial technology company in the process of reinventing
                            <span className="max-md:hidden">banking. 30-day free trial.</span>
                        </p>
                        <div className="mt-8 flex w-full flex-col-reverse items-stretch gap-3 sm:w-auto sm:flex-row sm:items-start md:mt-12">
                            <Button iconLeading={PlayCircle} color="secondary" size="xl">
                                Demo
                            </Button>
                            <Button size="xl">Sign up</Button>
                        </div>
                    </div>
                </div>

                <div className="mx-auto mt-16 w-full max-w-container md:px-8">
                    <div className="flex h-51 items-end justify-center bg-brand-section md:h-129">
                        <div className="flex -translate-y-[53px] items-start justify-end md:translate-y-3">
                            <div
                                className="absolute origin-right [transform:var(--transform-mobile)] md:[transform:var(--transform-desktop)]"
                                style={
                                    {
                                        "--transform-mobile": "scale(0.7) translate(-59px, 39px) rotate(30deg)",
                                        "--transform-desktop": "scale(1.77) translate(-59px, 39px) rotate(30deg)",
                                    } as React.CSSProperties
                                }
                            >
                                <CreditCard type="transparent-gradient" cardHolder="Phoenix Baker" />
                            </div>
                            <div
                                className="absolute origin-right [transform:var(--transform-mobile)] md:[transform:var(--transform-desktop)]"
                                style={
                                    {
                                        "--transform-mobile": "scale(0.7) translate(-38px, 10px) rotate(60deg)",
                                        "--transform-desktop": "scale(1.77) translate(-38px, 10px) rotate(60deg)",
                                    } as React.CSSProperties
                                }
                            >
                                <CreditCard type="transparent-gradient" cardHolder="OLIVIA RHYE" />
                            </div>
                            <div
                                className="absolute origin-right [transform:var(--transform-mobile)] md:[transform:var(--transform-desktop)]"
                                style={
                                    {
                                        "--transform-mobile": "scale(0.7) translate(0px, 0px) rotate(90deg)",
                                        "--transform-desktop": "scale(1.77) translate(0px, 0px) rotate(90deg)",
                                    } as React.CSSProperties
                                }
                            >
                                <CreditCard type="transparent-gradient" cardHolder="Lana Steiner" />
                            </div>
                            <div
                                className="absolute origin-right [transform:var(--transform-mobile)] md:[transform:var(--transform-desktop)]"
                                style={
                                    {
                                        "--transform-mobile": "scale(0.7) translate(36px, 10px) rotate(120deg)",
                                        "--transform-desktop": "scale(1.77) translate(36px, 10px) rotate(120deg)",
                                    } as React.CSSProperties
                                }
                            >
                                <CreditCard type="transparent-gradient" cardHolder="Demi Wilkinson" />
                            </div>
                            <div
                                className="absolute origin-right [transform:var(--transform-mobile)] md:[transform:var(--transform-desktop)]"
                                style={
                                    {
                                        "--transform-mobile": "scale(0.7) translate(59px, 39px) rotate(150deg)",
                                        "--transform-desktop": "scale(1.77) translate(59px, 39px)  rotate(150deg)",
                                    } as React.CSSProperties
                                }
                            >
                                <CreditCard type="transparent-gradient" cardHolder="Candice wu" />
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};
