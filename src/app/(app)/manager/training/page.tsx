"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ManagerCategoriesPanel } from "@/components/manager/manager-categories-panel";
import { ManagerRotationToggle } from "@/components/manager/manager-rotation-toggle";
import { ManagerSubmitMaterials } from "@/components/manager/manager-submit-materials";
import {
  ManagerAssignRefresher,
  type RefresherPrefill,
} from "@/components/manager/manager-assign-refresher";
import { getCategoriesForOrgType, slugify } from "@/lib/competency/domains";
import { useAppStore } from "@/lib/store/app-store";
import { useCurrentOrg, useCurrentUser } from "@/lib/store/hooks";

function ManagerTrainingContent() {
  const org = useCurrentOrg();
  const user = useCurrentUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const competencyDomains = useAppStore((s) => s.competencyDomains);

  const categorySlug = searchParams.get("category");
  const activeCategoryName = useMemo(() => {
    if (!categorySlug) return null;
    const orgDomains = competencyDomains.filter((d) => d.orgId === user.orgId);
    const fromDomain = orgDomains.find((d) => d.slug === categorySlug);
    if (fromDomain) return fromDomain.name;

    const orgType = org?.orgType || "snf";
    const cats = getCategoriesForOrgType(orgType);
    return cats.find((c) => slugify(c) === categorySlug) ?? null;
  }, [categorySlug, competencyDomains, user.orgId, org?.orgType]);

  const prefill: RefresherPrefill | null = useMemo(() => {
    const title = searchParams.get("refresherTitle");
    const description = searchParams.get("refresherDesc");
    const incident = searchParams.get("incident");
    if (!title && !description && !incident) return null;
    const orgType = org?.orgType || "snf";
    const cats = getCategoriesForOrgType(orgType);
    return {
      mode: "incident" as const,
      title: title ?? undefined,
      description: description ?? incident ?? undefined,
      category: searchParams.get("refresherCategory") ?? undefined,
    };
  }, [searchParams, org?.orgType]);

  useEffect(() => {
    if (!prefill || activeCategoryName) return;
    const el = document.getElementById("assign-refresher");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [prefill, activeCategoryName]);

  const openCategory = (name: string) => {
    router.push(`/manager/training?category=${slugify(name)}`);
  };

  const closeCategory = () => {
    router.push("/manager/training");
  };

  if (activeCategoryName) {
    return (
      <div className="space-y-6">
        <ManagerCategoriesPanel
          showHeader={false}
          activeCategoryName={activeCategoryName}
          onBack={closeCategory}
        />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm text-muted-foreground">{org?.name}</p>
        <h1 className="text-2xl font-bold tracking-tight">Training</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage categories, request new content, and assign refreshers.
        </p>
      </div>

      <ManagerRotationToggle />

      <ManagerCategoriesPanel onCategorySelect={openCategory} />

      <div className="border-t pt-8 space-y-6">
        <ManagerSubmitMaterials />
        <ManagerAssignRefresher prefill={prefill} />
      </div>
    </div>
  );
}

export default function ManagerTrainingPage() {
  return (
    <Suspense fallback={null}>
      <ManagerTrainingContent />
    </Suspense>
  );
}