"use client";

/**
 * Settings — the category dropdown options and the configurable second
 * dropdown (label + options; e.g. "Department"). When the second dropdown has
 * options, every charge additionally needs one before it counts as complete.
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/layout/page-header";
import { TableSkeleton } from "@/components/shared/loading";
import { useSaveSettings, useSpendSettings } from "@/features/spend";

const toLines = (xs: string[]) => xs.join("\n");
const fromLines = (s: string) =>
  s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

export function SpendSettingsView() {
  const { data, isLoading } = useSpendSettings();
  const save = useSaveSettings();
  const [categories, setCategories] = useState("");
  const [tagLabel, setTagLabel] = useState("Department");
  const [tagOptions, setTagOptions] = useState("");

  useEffect(() => {
    if (!data) return;
    setCategories(toLines(data.categories));
    setTagLabel(data.tagLabel);
    setTagOptions(toLines(data.tagOptions));
  }, [data]);

  if (isLoading) return <TableSkeleton rows={6} />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Administration"
        title="Settings"
        description="Dropdown options for completing charges. One value per line — existing charges keep removed values."
      />

      <div className="grid grid-cols-1 gap-4 @2xl/main:grid-cols-2">
        <Card className="flex flex-col gap-3 p-5">
          <div>
            <h3 className="text-sm font-semibold">Categories</h3>
            <p className="text-sm text-muted-foreground">
              For charges with no invoice (bank fees, GST lines) — picking one marks the charge
              “No invoice needed”.
            </p>
          </div>
          <Textarea
            rows={8}
            value={categories}
            onChange={(e) => setCategories(e.target.value)}
          />
        </Card>

        <Card className="flex flex-col gap-3 p-5">
          <div>
            <h3 className="text-sm font-semibold">Second dropdown</h3>
            <p className="text-sm text-muted-foreground">
              Configurable dropdown every charge must have (multi-select). Leave the options
              empty to hide it entirely.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tag-label">Name</Label>
            <Input
              id="tag-label"
              value={tagLabel}
              onChange={(e) => setTagLabel(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tag-options">Options (one per line)</Label>
            <Textarea
              id="tag-options"
              rows={6}
              value={tagOptions}
              onChange={(e) => setTagOptions(e.target.value)}
            />
          </div>
        </Card>
      </div>

      <div>
        <Button
          loading={save.isPending}
          disabled={fromLines(categories).length === 0 || !tagLabel.trim()}
          onClick={() =>
            save.mutate({
              categories: fromLines(categories),
              tagLabel: tagLabel.trim(),
              tagOptions: fromLines(tagOptions),
            })
          }
        >
          Save settings
        </Button>
      </div>
    </div>
  );
}
