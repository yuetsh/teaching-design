<script setup lang="ts">
import { computed, toRaw } from 'vue'
import { createTeachingStep, type TeachingDesign, type TeachingStep } from '../domain/teachingDesign'
import EditableMarkdown from './EditableMarkdown.vue'
import EditableText from './EditableText.vue'

const props = defineProps<{
  design: TeachingDesign
  editable: boolean
}>()

const emit = defineEmits<{ 'update:design': [design: TeachingDesign] }>()

function update(mutator: (design: TeachingDesign) => void): void {
  const clone = JSON.parse(JSON.stringify(toRaw(props.design))) as TeachingDesign
  mutator(clone)
  emit('update:design', clone)
}

const displayTitle = computed(
  () => props.design.title || `${props.design.topic} 教学设计`,
)

function setField<K extends keyof TeachingDesign>(field: K, value: TeachingDesign[K]): void {
  update((design) => {
    design[field] = value
  })
}

function setStepField<K extends keyof TeachingStep>(
  index: number,
  field: K,
  value: TeachingStep[K],
): void {
  update((design) => {
    const step = design.processSteps[index]
    if (step) step[field] = value
  })
}

function addStep(): void {
  update((design) => {
    design.processSteps.push(createTeachingStep(design.processSteps.length + 1))
  })
}

function removeStep(index: number): void {
  update((design) => {
    design.processSteps.splice(index, 1)
  })
}
</script>

<template>
  <section class="page teaching-design-page">
    <EditableText
      class="design-title"
      :model-value="displayTitle"
      label="教案标题"
      :editable="editable"
      @update:model-value="setField('title', $event)"
    />

    <table class="basic-info-table">
      <tbody>
        <tr>
          <th>课题</th>
          <td>
            <EditableText
              :model-value="design.topic"
              label="课题"
              :editable="editable"
              @update:model-value="setField('topic', $event)"
            />
          </td>
        </tr>
        <tr>
          <th>课时</th>
          <td>
            <EditableText
              :model-value="design.duration"
              label="课时"
              :editable="editable"
              @update:model-value="setField('duration', $event)"
            />
          </td>
        </tr>
        <tr>
          <th>教学目标</th>
          <td class="objectives-cell">
            <div class="objective-row">
              <span class="objective-label">知识目标</span>
              <EditableMarkdown
                :model-value="design.knowledgeObjective"
                label="知识目标"
                :editable="editable"
                @update:model-value="setField('knowledgeObjective', $event)"
              />
            </div>
            <div class="objective-row">
              <span class="objective-label">技能目标</span>
              <EditableMarkdown
                :model-value="design.skillObjective"
                label="技能目标"
                :editable="editable"
                @update:model-value="setField('skillObjective', $event)"
              />
            </div>
            <div class="objective-row">
              <span class="objective-label">素养目标</span>
              <EditableMarkdown
                :model-value="design.literacyObjective"
                label="素养目标"
                :editable="editable"
                @update:model-value="setField('literacyObjective', $event)"
              />
            </div>
          </td>
        </tr>
        <tr>
          <th>教学重难点</th>
          <td class="objectives-cell">
            <div class="objective-row">
              <span class="objective-label">重点</span>
              <EditableMarkdown
                :model-value="design.keyPoint"
                label="教学重点"
                :editable="editable"
                @update:model-value="setField('keyPoint', $event)"
              />
            </div>
            <div class="objective-row">
              <span class="objective-label">难点</span>
              <EditableMarkdown
                :model-value="design.difficultPoint"
                label="教学难点"
                :editable="editable"
                @update:model-value="setField('difficultPoint', $event)"
              />
            </div>
          </td>
        </tr>
        <tr>
          <th>教学资源准备</th>
          <td>
            <EditableMarkdown
              :model-value="design.resources"
              label="教学资源准备"
              :editable="editable"
              @update:model-value="setField('resources', $event)"
            />
          </td>
        </tr>
      </tbody>
    </table>

    <h2 class="section-heading">教学过程</h2>
    <table class="process-table">
      <thead>
        <tr>
          <th>教学环节</th>
          <th>教学内容</th>
          <th>教师活动</th>
          <th>学生活动</th>
          <th>设计意图</th>
          <th v-if="editable" class="no-print"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(step, index) in design.processSteps" :key="step.id">
          <td class="process-step-name">
            <EditableText
              :model-value="step.name"
              label="教学环节名称"
              :editable="editable"
              @update:model-value="setStepField(index, 'name', $event)"
            />
            <EditableText
              :model-value="step.duration"
              label="教学环节时长"
              :editable="editable"
              @update:model-value="setStepField(index, 'duration', $event)"
            />
          </td>
          <td>
            <EditableMarkdown
              :model-value="step.content"
              label="教学内容"
              :editable="editable"
              @update:model-value="setStepField(index, 'content', $event)"
            />
          </td>
          <td>
            <EditableMarkdown
              :model-value="step.teacherActivity"
              label="教师活动"
              :editable="editable"
              @update:model-value="setStepField(index, 'teacherActivity', $event)"
            />
          </td>
          <td>
            <EditableMarkdown
              :model-value="step.studentActivity"
              label="学生活动"
              :editable="editable"
              @update:model-value="setStepField(index, 'studentActivity', $event)"
            />
          </td>
          <td>
            <EditableMarkdown
              :model-value="step.intention"
              label="设计意图"
              :editable="editable"
              @update:model-value="setStepField(index, 'intention', $event)"
            />
          </td>
          <td v-if="editable" class="no-print process-step-actions">
            <button
              type="button"
              :data-testid="`remove-step-${index}`"
              :disabled="design.processSteps.length <= 1"
              @click="removeStep(index)"
            >
              删除环节
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <button v-if="editable" type="button" class="no-print" data-testid="add-step" @click="addStep">
      添加教学环节
    </button>

    <h2 class="section-heading">板书设计</h2>
    <EditableText
      class="board-design"
      :model-value="design.boardDesign"
      label="板书设计"
      multiline
      :editable="editable"
      @update:model-value="setField('boardDesign', $event)"
    />

    <h2 class="section-heading">教学成效与反思</h2>
    <table class="reflection-table">
      <tbody>
        <tr>
          <th>教学成效</th>
          <td>
            <EditableMarkdown
              :model-value="design.effectiveness"
              label="教学成效"
              :editable="editable"
              @update:model-value="setField('effectiveness', $event)"
            />
          </td>
        </tr>
        <tr>
          <th>教学反思</th>
          <td>
            <EditableMarkdown
              :model-value="design.reflection"
              label="教学反思"
              :editable="editable"
              @update:model-value="setField('reflection', $event)"
            />
          </td>
        </tr>
      </tbody>
    </table>

    <template v-if="design.additionalContent || editable">
      <h2 class="section-heading">附加内容</h2>
      <EditableMarkdown
        :model-value="design.additionalContent"
        label="附加内容"
        :editable="editable"
        @update:model-value="setField('additionalContent', $event)"
      />
    </template>

    <ul v-if="design.warnings.length" class="warning-summary no-print">
      <li v-for="warning in design.warnings" :key="warning.code">{{ warning.message }}</li>
    </ul>
  </section>
</template>
